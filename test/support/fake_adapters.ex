defmodule Loom.Test.FakeBoard do
  def start_link(responses) do
    Agent.start_link(fn -> %{claimable: responses, states: %{}} end)
  end

  def adapter(agent) do
    %{
      claimable: fn role ->
        Agent.get_and_update(agent, fn state ->
          case state.claimable do
            [response | rest] -> {response_for(response, role), %{state | claimable: rest}}
            [] -> {:none, state}
          end
        end)
      end,
      state: fn item -> Agent.get(agent, &Map.get(&1.states, item.id, {:ok, item.stage})) end
    }
  end

  def set_state(agent, item_id, response),
    do: Agent.update(agent, &put_in(&1, [:states, item_id], response))

  def push_claimable(agent, response),
    do: Agent.update(agent, &%{&1 | claimable: &1.claimable ++ [response]})

  defp response_for(fun, role) when is_function(fun, 1), do: fun.(role)
  defp response_for(response, _role), do: response
end

defmodule Loom.Test.FakeHarness do
  def start_link do
    Agent.start_link(fn -> %{starts: [], stops: []} end)
  end

  def adapter(agent) do
    %{
      start: fn spec, owner ->
        handle = make_ref()
        Agent.update(agent, &%{&1 | starts: &1.starts ++ [{spec, owner, handle}]})
        {:ok, handle}
      end,
      stop: fn handle, mode ->
        Agent.update(agent, &%{&1 | stops: &1.stops ++ [{handle, mode}]})
        :ok
      end
    }
  end

  def starts(agent), do: Agent.get(agent, & &1.starts)
  def stops(agent), do: Agent.get(agent, & &1.stops)
end
