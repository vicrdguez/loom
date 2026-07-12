defmodule Loom.UI.App do
  @moduledoc false
  use ExRatatui.App

  alias Loom.{Command, Console, Lane, UI}
  alias ExRatatui.Event

  @impl true
  def mount(opts) do
    console = Keyword.fetch!(opts, :console)
    console_snapshot = Console.snapshot(console)

    lanes =
      Map.new(console_snapshot.lanes, fn {role, lane} ->
        :ok = Lane.subscribe(lane)
        {role, Lane.snapshot(lane)}
      end)

    {:ok,
     %{
       console: console,
       project: console_snapshot.project,
       lane_pids: console_snapshot.lanes,
       lanes: lanes,
       focus: Map.get(console_snapshot.preferences, :focus, :implementor),
       command: "",
       inline_result: nil,
       inspector: nil,
       quit_pending: false
     }}
  end

  @impl true
  def render(state, frame), do: state |> UI.render({frame.width, frame.height}) |> UI.widgets()

  @impl true
  def handle_event(%Event.Key{code: "esc"}, %{inspector: inspector} = state)
      when not is_nil(inspector) do
    {:noreply, UI.dismiss_inspector(state)}
  end

  def handle_event(%Event.Key{code: "backspace"}, state) do
    {:noreply,
     %{state | command: String.slice(state.command, 0, max(String.length(state.command) - 1, 0))}}
  end

  def handle_event(%Event.Key{code: "enter"}, state), do: execute(state)

  def handle_event(%Event.Key{code: code}, state) when is_binary(code) and byte_size(code) == 1 do
    {:noreply, %{state | command: state.command <> code}}
  end

  def handle_event(_event, state), do: {:noreply, state}

  @impl true
  def handle_info({:lane_snapshot, lane, snapshot}, state) do
    role = Enum.find_value(state.lane_pids, fn {role, pid} -> if pid == lane, do: role end)
    {:noreply, %{state | lanes: Map.put(state.lanes, role, snapshot)}}
  end

  def handle_info(_message, state), do: {:noreply, state}

  @impl true
  def terminate(_reason, state) do
    if Process.alive?(state.console), do: Console.quit(state.console, confirm: true)
    :ok
  catch
    :exit, _reason -> :ok
  end

  defp execute(state) do
    command = state.command
    state = %{state | command: ""}

    case Command.parse(command) do
      {:query, query} ->
        result = Command.run({:query, query}, query_snapshot(state))
        {:noreply, UI.present_result(state, result)}

      {:focus, role} ->
        {:noreply, %{state | focus: role}}

      {:lane_action, role, action} ->
        result = Lane.command(Map.fetch!(state.lane_pids, role), action)
        {:noreply, %{state | inline_result: inspect(result)}}

      {:config, _role} ->
        {:noreply,
         %{state | inline_result: "Model configuration is collected in the config form."}}

      :quit ->
        quit(state)

      {:error, reason} ->
        {:noreply, %{state | inline_result: inspect(reason)}}
    end
  end

  defp quit(%{quit_pending: true} = state) do
    case Console.quit(state.console, confirm: true) do
      :ok ->
        {:stop, state}

      {:force_required, failures} ->
        {:noreply, %{state | inline_result: "Force required: #{inspect(failures)}"}}
    end
  end

  defp quit(state) do
    case Console.quit(state.console) do
      :ok ->
        {:stop, state}

      {:confirmation_required, roles} ->
        {:noreply,
         %{
           state
           | quit_pending: true,
             inline_result:
               "Workers active: #{Enum.join(roles, ", ")}. Run quit again to stop them."
         }}
    end
  end

  defp query_snapshot(state) do
    lane = Map.fetch!(state.lanes, state.focus)
    progress = lane.progress || %{}

    %{
      status: lane,
      tasks: Map.get(progress, :tasks, :absent),
      log: Map.get(progress, :slice_commits, []),
      diff: read_diff(state.project),
      board: Map.get(progress, :board_stage, :unknown),
      activity: lane.activity,
      refresh: progress
    }
  end

  defp read_diff(project) do
    case System.cmd("git", ["-C", project, "diff", "--no-ext-diff", "--"], stderr_to_stdout: true) do
      {output, 0} -> output
      {output, _status} -> output
    end
  end
end
