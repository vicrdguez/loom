defmodule Loom.Lane do
  @moduledoc """
  Persistent Role-lane state machine.

  A lane owns at most one transient Worker. Process exit is never success on its
  own: only a read of Board truth can complete an invocation.
  """

  use GenServer

  @roles [:implementor, :reviewer]
  @actions [:pause, :resume, :retry, :stop, :force_stop]

  def start_link(opts) do
    GenServer.start_link(__MODULE__, opts)
  end

  def subscribe(lane), do: GenServer.call(lane, {:subscribe, self()})
  def snapshot(lane), do: GenServer.call(lane, :snapshot)
  def configure(lane, spec), do: GenServer.call(lane, {:configure, spec})
  def refresh(lane), do: GenServer.call(lane, :refresh)
  def command(lane, action) when action in @actions, do: GenServer.call(lane, {:command, action})
  def poll(lane), do: GenServer.cast(lane, :poll)

  @impl true
  def init(opts) do
    role = Keyword.fetch!(opts, :role)
    true = role in @roles
    now = DateTime.utc_now()

    restored = Keyword.get(opts, :restore, %{})

    state = %{
      role: role,
      spec: Keyword.fetch!(opts, :spec),
      board: opts |> Keyword.fetch!(:deps) |> Map.fetch!(:board),
      harness: opts |> Keyword.fetch!(:deps) |> Map.fetch!(:harness),
      backoffs: opts |> Keyword.fetch!(:deps) |> Map.get(:backoffs, [5_000, 30_000, 120_000]),
      poll_interval: opts |> Keyword.fetch!(:deps) |> Map.get(:poll_interval, 60_000),
      progress_reader: opts |> Keyword.fetch!(:deps) |> Map.get(:progress),
      auto_poll: Keyword.get(opts, :auto_poll, true),
      timer_ref: nil,
      status: restored_status(restored),
      current: nil,
      worker: nil,
      retry_count: Map.get(restored, :retry_count, 0),
      failures: Map.get(restored, :failures, []),
      manual_pause: Map.get(restored, :manual_pause, false),
      last_outcome: nil,
      started_at: now,
      worker_started_at: nil,
      last_event_at: nil,
      next_poll_at:
        next_poll(now, opts |> Keyword.fetch!(:deps) |> Map.get(:poll_interval, 60_000)),
      activity: Map.get(restored, :activity, []),
      progress: Map.get(restored, :progress),
      subscribers: MapSet.new()
    }

    if Keyword.get(opts, :auto_poll, true), do: send(self(), :poll)
    {:ok, state}
  end

  @impl true
  def handle_call(:snapshot, _from, state), do: {:reply, public_snapshot(state), state}

  def handle_call(:refresh, _from, state) do
    state = refresh_progress(state)
    {:reply, state.progress, publish(state)}
  end

  def handle_call({:configure, spec}, _from, state) do
    {:reply, :ok, publish(%{state | spec: spec})}
  end

  def handle_call({:subscribe, subscriber}, _from, state) do
    Process.monitor(subscriber)
    send(subscriber, {:lane_snapshot, self(), public_snapshot(state)})
    {:reply, :ok, %{state | subscribers: MapSet.put(state.subscribers, subscriber)}}
  end

  def handle_call({:command, :pause}, _from, %{status: :running} = state) do
    {:reply, :ok, publish(%{state | manual_pause: true})}
  end

  def handle_call({:command, :pause}, _from, state) do
    {:reply, :ok, publish(%{state | status: :paused, manual_pause: true})}
  end

  def handle_call({:command, :resume}, _from, state) do
    send(self(), :poll)
    {:reply, :ok, publish(%{state | status: :idle, manual_pause: false})}
  end

  def handle_call({:command, :retry}, _from, state) do
    send(self(), :poll)

    {:reply, :ok,
     publish(%{state | status: :idle, manual_pause: false, retry_count: 0, failures: []})}
  end

  def handle_call({:command, :stop}, _from, %{worker: nil} = state) do
    {:reply, :ok, publish(%{state | status: :paused, manual_pause: true})}
  end

  def handle_call({:command, :stop}, _from, state) do
    case state.harness.stop.(state.worker, :graceful) do
      :ok -> {:reply, :ok, stopped(state)}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  def handle_call({:command, :force_stop}, _from, %{worker: nil} = state) do
    {:reply, :ok, stopped(state)}
  end

  def handle_call({:command, :force_stop}, _from, state) do
    case state.harness.stop.(state.worker, :force) do
      :ok -> {:reply, :ok, stopped(state)}
      {:error, reason} -> {:reply, {:error, reason}, state}
    end
  end

  @impl true
  def handle_cast(:poll, state), do: {:noreply, do_poll(state)}

  @impl true
  def handle_info(:poll, state), do: {:noreply, do_poll(state)}

  def handle_info({:harness_event, worker, event}, %{worker: worker} = state) do
    state = %{
      state
      | last_event_at: DateTime.utc_now(),
        activity: Enum.take(state.activity ++ [event], -200)
    }

    {:noreply, publish(state)}
  end

  def handle_info({:harness_exit, worker, status}, %{worker: worker} = state) do
    {:noreply, reconcile_exit(%{state | worker: nil}, {:exit, status})}
  end

  def handle_info({:DOWN, _reference, :process, subscriber, _reason}, state) do
    {:noreply, %{state | subscribers: MapSet.delete(state.subscribers, subscriber)}}
  end

  def handle_info(_message, state), do: {:noreply, state}

  defp do_poll(%{worker: worker} = state) when not is_nil(worker), do: cancel_timer(state)
  defp do_poll(%{status: :paused} = state), do: cancel_timer(state)
  defp do_poll(%{manual_pause: true} = state), do: cancel_timer(state)

  defp do_poll(state) do
    state = cancel_timer(state)

    case state.board.claimable.(state.role) do
      {:ok, item} -> launch(state, item)
      :none -> idle(state)
      {:error, reason} -> degraded(state, reason)
    end
  end

  defp launch(state, item) do
    state = refresh_progress(%{state | current: item})
    spec = Map.merge(state.spec, %{role: state.role, change: item, fresh_context: true})

    case state.harness.start.(spec, self()) do
      {:ok, worker} ->
        publish(%{
          state
          | status: :running,
            current: item,
            worker: worker,
            worker_started_at: DateTime.utc_now(),
            last_event_at: nil,
            next_poll_at: nil
        })

      {:error, reason} ->
        record_failure(%{state | current: item}, {:launch_failed, reason})
    end
  end

  defp reconcile_exit(%{current: nil} = state, reason), do: record_failure(state, reason)

  defp reconcile_exit(state, reason) do
    case state.board.state.(state.current) do
      {:ok, stage} ->
        if claimable_stage?(state.role, stage) do
          record_failure(state, {:no_handoff, reason})
        else
          status = if state.manual_pause, do: :paused, else: :cooldown

          state = refresh_progress(%{state | current: Map.put(state.current, :stage, stage)})

          publish(
            schedule(
              %{
                state
                | status: status,
                  retry_count: 0,
                  failures: [],
                  last_outcome: :handoff,
                  next_poll_at: next_poll(DateTime.utc_now(), 5_000)
              },
              5_000
            )
          )
        end

      {:error, reason} ->
        degraded(state, reason)
    end
  end

  defp record_failure(state, reason) do
    retry_count = state.retry_count + 1
    failures = Enum.take(state.failures ++ [reason], -3)
    status = if retry_count >= 3, do: :paused, else: :backoff

    next_state = %{
      state
      | status: status,
        retry_count: retry_count,
        failures: failures,
        last_outcome: reason,
        next_poll_at: next_poll(DateTime.utc_now(), Enum.at(state.backoffs, retry_count - 1, 0))
    }

    if status == :paused do
      publish(cancel_timer(next_state))
    else
      publish(schedule(next_state, Enum.at(state.backoffs, retry_count - 1, 0)))
    end
  end

  defp idle(state) do
    publish(
      schedule(
        %{
          state
          | status: :idle,
            next_poll_at: next_poll(DateTime.utc_now(), state.poll_interval)
        },
        state.poll_interval
      )
    )
  end

  defp stopped(state) do
    publish(%{
      state
      | worker: nil,
        status: :paused,
        manual_pause: true,
        last_outcome: :stopped
    })
  end

  defp degraded(state, reason) do
    publish(
      schedule(
        %{
          state
          | status: :degraded,
            last_outcome: {:board_unavailable, reason},
            next_poll_at: next_poll(DateTime.utc_now(), state.poll_interval)
        },
        state.poll_interval
      )
    )
  end

  defp claimable_stage?(:implementor, stage), do: stage in [:ready, :rework]
  defp claimable_stage?(:reviewer, stage), do: stage == :review

  defp next_poll(now, milliseconds), do: DateTime.add(now, milliseconds, :millisecond)

  defp refresh_progress(%{progress_reader: nil} = state), do: state
  defp refresh_progress(%{current: nil} = state), do: state
  defp refresh_progress(state), do: %{state | progress: state.progress_reader.(state.current)}

  defp schedule(%{auto_poll: false} = state, _milliseconds), do: state

  defp schedule(state, milliseconds) do
    state = cancel_timer(state)
    %{state | timer_ref: Process.send_after(self(), :poll, milliseconds)}
  end

  defp cancel_timer(%{timer_ref: nil} = state), do: state

  defp cancel_timer(state) do
    Process.cancel_timer(state.timer_ref)
    %{state | timer_ref: nil}
  end

  defp publish(state) do
    snapshot = public_snapshot(state)
    Enum.each(state.subscribers, &send(&1, {:lane_snapshot, self(), snapshot}))
    state
  end

  defp public_snapshot(state) do
    Map.take(state, [
      :role,
      :spec,
      :status,
      :current,
      :worker,
      :retry_count,
      :failures,
      :manual_pause,
      :last_outcome,
      :started_at,
      :worker_started_at,
      :last_event_at,
      :next_poll_at,
      :activity,
      :progress
    ])
  end

  defp restored_status(%{manual_pause: true}), do: :paused
  defp restored_status(%{retry_count: count}) when count >= 3, do: :paused
  defp restored_status(_restored), do: :idle
end
