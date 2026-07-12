defmodule Loom.Harness.Codex.Worker do
  @moduledoc false
  use GenServer

  alias Loom.Harness.Codex.Event

  def start_link(executable, args, opts) do
    GenServer.start_link(__MODULE__, {executable, args, Keyword.fetch!(opts, :owner)})
  end

  def stop(pid, :graceful), do: GenServer.stop(pid, :normal, 10_000)
  def stop(pid, :force), do: GenServer.stop(pid, :kill)

  @impl true
  def init({executable, args, owner}) do
    port =
      Port.open({:spawn_executable, String.to_charlist(executable)}, [
        :binary,
        :exit_status,
        :stderr_to_stdout,
        {:line, 1_000_000},
        args: Enum.map(args, &String.to_charlist/1)
      ])

    {:ok, %{port: port, owner: owner, fragment: ""}}
  rescue
    error -> {:stop, {:launch_failed, Exception.message(error)}}
  end

  @impl true
  def handle_info({port, {:data, {:eol, line}}}, %{port: port} = state) do
    emit(state.owner, state.fragment <> line)
    {:noreply, %{state | fragment: ""}}
  end

  def handle_info({port, {:data, {:noeol, line}}}, %{port: port} = state) do
    {:noreply, %{state | fragment: state.fragment <> line}}
  end

  def handle_info({port, {:exit_status, status}}, %{port: port} = state) do
    send(state.owner, {:harness_exit, self(), status})
    {:stop, :normal, state}
  end

  @impl true
  def terminate(_reason, %{port: port}) do
    if Port.info(port), do: Port.close(port)
    :ok
  end

  defp emit(owner, line) do
    case Event.decode(line) do
      :ignore -> :ok
      event -> send(owner, {:harness_event, self(), event})
    end
  end
end
