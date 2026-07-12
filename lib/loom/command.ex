defmodule Loom.Command do
  @moduledoc "Deterministic local command grammar and read-only result formatting."

  @queries ~w(status tasks log diff board activity refresh help)a
  @role_names %{
    "implement" => :implementor,
    "implementor" => :implementor,
    "review" => :reviewer,
    "reviewer" => :reviewer
  }

  @help """
  status · tasks · log · diff · board · activity · refresh
  focus implement|review · config implement|review
  pause|resume|retry|stop implement|review · help · quit
  """

  def parse(text) when is_binary(text) do
    command = String.trim(text)

    result =
      case String.split(command, ~r/\s+/, trim: true) do
        [query] when query in ~w(status tasks log diff board activity refresh help) ->
          {:query, String.to_existing_atom(query)}

        ["focus", role] ->
          with {:ok, normalized} <- role(role), do: {:focus, normalized}

        ["config", role] ->
          with {:ok, normalized} <- role(role), do: {:config, normalized}

        [action, role] when action in ~w(pause resume retry stop) ->
          with {:ok, normalized} <- role(role),
               do: {:lane_action, normalized, String.to_existing_atom(action)}

        ["quit"] ->
          :quit

        _ ->
          {:error, {:unsupported_command, command}}
      end

    if result == :error, do: {:error, {:unsupported_command, command}}, else: result
  end

  def run({:query, query}, snapshot, opts \\ []) when query in @queries do
    content = query_content(query, snapshot)
    max_inline = Keyword.get(opts, :max_inline, 500)

    if byte_size(content) > max_inline do
      {:inspector, format(query), content}
    else
      {:inline, content}
    end
  end

  defp query_content(:help, _snapshot), do: String.trim(@help)

  defp query_content(query, snapshot),
    do: snapshot |> Map.get(query, "No #{query} data") |> present()

  defp present(value) when is_binary(value), do: value
  defp present(value), do: inspect(value, pretty: true, limit: :infinity)

  defp format(:diff), do: :code
  defp format(:log), do: :code
  defp format(_query), do: :markdown

  defp role(name) do
    case @role_names do
      %{^name => role} -> {:ok, role}
      _ -> :error
    end
  end
end
