defmodule Loom.Harness.Codex.Event do
  @moduledoc """
  Translates Codex JSONL into the small event vocabulary understood by a lane.

  Mechanical events are deliberately discarded here so neither the UI nor the
  persistent store can accidentally retain raw transcripts.
  """

  @spec decode(binary()) ::
          {:activity, binary()}
          | {:lifecycle, atom(), map()}
          | {:failure, binary()}
          | :ignore
          | {:error, term()}
  def decode(line) when is_binary(line) do
    line
    |> :json.decode()
    |> normalize()
  rescue
    error -> {:error, {:invalid_json, Exception.message(error)}}
  end

  defp normalize(%{
         "type" => "item.completed",
         "item" => %{"type" => "agent_message", "text" => text}
       })
       when is_binary(text),
       do: {:activity, text}

  defp normalize(%{"type" => "thread.started", "thread_id" => thread_id})
       when is_binary(thread_id),
       do: {:lifecycle, :thread_started, %{thread_id: thread_id}}

  defp normalize(%{"type" => "thread.started"}), do: {:error, {:missing_field, "thread_id"}}
  defp normalize(%{"type" => "turn.started"}), do: {:lifecycle, :turn_started, %{}}
  defp normalize(%{"type" => "turn.completed"}), do: {:lifecycle, :turn_completed, %{}}
  defp normalize(%{"type" => "error", "message" => message}), do: {:failure, message}
  defp normalize(_event), do: :ignore
end
