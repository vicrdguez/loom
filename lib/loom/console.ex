defmodule Loom.Console do
  @moduledoc "Owns the two persistent Role lanes and their local operator intent."

  use GenServer

  alias Loom.{Lane, Store, WorkerSpec}

  @roles [:implementor, :reviewer]

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts)
  def snapshot(console), do: GenServer.call(console, :snapshot)

  def config(console, role, model, effort),
    do: GenServer.call(console, {:config, role, model, effort})

  def quit(console, opts \\ []), do: GenServer.call(console, {:quit, opts}, 15_000)

  @impl true
  def init(opts) do
    Process.flag(:trap_exit, true)
    project = Keyword.fetch!(opts, :project)
    store = Keyword.fetch!(opts, :store)
    loaded = Store.load(store)
    {specs, warnings} = load_or_configure_specs(loaded.state, project, Keyword.get(opts, :setup))
    preferences = Map.get(loaded.state, :preferences, %{focus: :implementor})
    pauses = Map.get(loaded.state, :pauses, %{})
    failures = Map.get(loaded.state, :failures, %{})
    progress = Keyword.get(opts, :progress, fn _role -> nil end)

    lanes =
      Map.new(@roles, fn role ->
        failure = Map.get(failures, role, %{})

        restore = %{
          manual_pause: Map.get(pauses, role, false),
          retry_count: Map.get(failure, :count, 0),
          failures: if(Map.get(failure, :count, 0) > 0, do: [failure], else: []),
          activity: Enum.filter(loaded.history, &(&1.role == role)),
          progress: progress.(role)
        }

        {:ok, lane} =
          Lane.start_link(
            role: role,
            spec: Map.fetch!(specs, role),
            deps: Keyword.fetch!(opts, :lane_deps),
            auto_poll: Keyword.get(opts, :auto_poll, true),
            restore: restore
          )

        {role, lane}
      end)

    state = %{
      project: project,
      store: store,
      specs: specs,
      warnings: warnings,
      preferences: preferences,
      pauses: pauses,
      failures: failures,
      lanes: lanes
    }

    persist(state)
    {:ok, state}
  end

  @impl true
  def handle_call(:snapshot, _from, state), do: {:reply, Map.drop(state, [:store]), state}

  def handle_call({:config, role, model, effort}, _from, state) when role in @roles do
    spec = state.specs |> Map.fetch!(role) |> WorkerSpec.update(model, effort)
    :ok = Lane.configure(Map.fetch!(state.lanes, role), spec)
    state = %{state | specs: Map.put(state.specs, role, spec)}
    persist(state)
    {:reply, :ok, state}
  end

  def handle_call({:quit, opts}, _from, state) do
    active = active_roles(state)

    cond do
      active != [] and not Keyword.get(opts, :confirm, false) ->
        {:reply, {:confirmation_required, active}, state}

      true ->
        mode = if Keyword.get(opts, :force, false), do: :force_stop, else: :stop

        failures =
          Enum.flat_map(active, fn role ->
            case Lane.command(Map.fetch!(state.lanes, role), mode) do
              :ok -> []
              {:error, reason} -> [{role, reason}]
            end
          end)

        if failures == [] do
          {:stop, :normal, :ok, state}
        else
          {:reply, {:force_required, failures}, state}
        end
    end
  end

  @impl true
  def terminate(_reason, state) do
    Enum.each(state.lanes, fn {_role, lane} ->
      if Process.alive?(lane) and Lane.snapshot(lane).worker != nil, do: Lane.command(lane, :stop)
    end)

    :ok
  end

  defp load_or_configure_specs(%{specs: specs}, _project, _setup), do: validate(specs)

  defp load_or_configure_specs(_state, project, setup) when is_function(setup, 0) do
    choices = setup.()

    specs =
      Map.new(@roles, fn role ->
        choice = Map.fetch!(choices, role)
        {role, WorkerSpec.new(role, choice.model, choice.reasoning_effort, project)}
      end)

    validate(specs)
  end

  defp load_or_configure_specs(_state, _project, _setup),
    do: raise("Worker-console setup is required")

  defp validate(specs) do
    {:ok, specs, warnings} = WorkerSpec.validate(specs)
    {specs, warnings}
  end

  defp active_roles(state) do
    Enum.filter(@roles, &(Lane.snapshot(Map.fetch!(state.lanes, &1)).worker != nil))
  end

  defp persist(state) do
    Store.save(state.store, %{
      specs: state.specs,
      preferences: state.preferences,
      pauses: state.pauses,
      failures: state.failures
    })
  end
end
