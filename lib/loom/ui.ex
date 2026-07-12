defmodule Loom.UI do
  @moduledoc "Pure responsive frame model plus ExRatatui widget translation."

  alias ExRatatui.Layout.Rect
  alias ExRatatui.Widgets.{Block, Markdown, Paragraph}

  @wide_breakpoint 96

  def render(state, {width, height}) when width > 0 and height > 1 do
    layout = if width >= @wide_breakpoint, do: :wide, else: :narrow
    roles = if layout == :wide, do: [:implementor, :reviewer], else: [state.focus]
    body_height = height - 1

    lanes =
      roles
      |> Enum.with_index()
      |> Enum.map(fn {role, index} ->
        lane = Map.fetch!(state.lanes, role)
        {x, lane_width} = lane_geometry(layout, width, index)
        lane_frame(lane, %Rect{x: x, y: 0, width: lane_width, height: body_height})
      end)

    %{
      width: width,
      height: height,
      layout: layout,
      lanes: lanes,
      role_switcher: if(layout == :narrow, do: [:implementor, :reviewer], else: nil),
      command_line: %{text: "loom> " <> state.command, y: height - 1, fixed_bottom: true},
      inline_result: Map.get(state, :inline_result),
      inspector: state.inspector
    }
  end

  def widgets(frame) do
    dashboard = Enum.flat_map(frame.lanes, &lane_widgets/1)

    command =
      {%Paragraph{text: frame.command_line.text},
       %Rect{x: 0, y: frame.command_line.y, width: frame.width, height: 1}}

    dashboard = dashboard ++ inline_widgets(frame) ++ [command]

    case frame.inspector do
      nil -> dashboard
      inspector -> dashboard ++ [inspector_widget(inspector, frame)]
    end
  end

  def present_result(state, {:inspector, format, content}) do
    %{state | inspector: %{format: format, content: content, dashboard: state}}
  end

  def present_result(state, {:inline, content}), do: Map.put(state, :inline_result, content)

  def dismiss_inspector(%{inspector: %{dashboard: dashboard}}), do: dashboard
  def dismiss_inspector(state), do: state

  defp lane_frame(lane, rect) do
    progress = lane.progress || %{}

    %{
      role: lane.role,
      rect: rect,
      header: header(lane),
      evidence: evidence(progress, lane.retry_count),
      activity_markdown: activity(lane.activity)
    }
  end

  defp header(lane) do
    change = if lane.current, do: lane.current.slug, else: "No Change"
    runtime = elapsed(lane.worker_started_at)
    last_event = elapsed(lane.last_event_at)

    "#{lane.role |> Atom.to_string() |> String.upcase()} · #{lane.status} · #{lane.spec.model}\n" <>
      "#{change} · runtime #{runtime} · last event #{last_event}"
  end

  defp evidence(progress, retry_count) do
    tasks =
      case Map.get(progress, :tasks, :absent) do
        %{checked: checked, total: total} -> "#{checked}/#{total}"
        :absent -> "no task ledger"
      end

    commits = progress |> Map.get(:slice_commits, []) |> length()

    "Board: #{Map.get(progress, :board_stage, :unknown)} · Tasks: #{tasks}\n" <>
      "Scenarios: #{Map.get(progress, :scenarios, 0)} · Commits: #{commits} · Retry: #{retry_count}/3"
  end

  defp activity(events) do
    events
    |> Enum.map(fn
      {:activity, markdown} ->
        markdown

      {:failure, reason} ->
        "**Error:** #{reason}"

      {:lifecycle, event, _metadata} ->
        "_#{event |> Atom.to_string() |> String.replace("_", " ")}_"

      %{event: event} ->
        activity([event])

      other ->
        "_#{inspect(other)}_"
    end)
    |> Enum.join("\n\n")
  end

  defp lane_widgets(lane) do
    rect = lane.rect
    header_rect = %Rect{x: rect.x, y: rect.y, width: rect.width, height: min(3, rect.height)}
    evidence_height = min(4, max(rect.height - header_rect.height, 0))

    evidence_rect = %Rect{
      x: rect.x,
      y: rect.y + header_rect.height,
      width: rect.width,
      height: evidence_height
    }

    activity_rect = %Rect{
      x: rect.x,
      y: evidence_rect.y + evidence_rect.height,
      width: rect.width,
      height: max(rect.height - header_rect.height - evidence_height, 0)
    }

    [
      {%Paragraph{
         text: lane.header,
         wrap: true,
         block: %Block{title: Atom.to_string(lane.role), borders: [:all], border_type: :rounded}
       }, header_rect},
      {%Paragraph{text: lane.evidence, wrap: true}, evidence_rect},
      {%Markdown{
         content: lane.activity_markdown,
         block: %Block{title: "Activity", borders: [:all]},
         wrap: true
       }, activity_rect}
    ]
  end

  defp inspector_widget(%{format: :code, content: content}, frame) do
    {%Paragraph{
       text: content,
       wrap: false,
       block: %Block{title: "Inspector · Esc to close", borders: [:all]}
     }, %Rect{x: 0, y: 0, width: frame.width, height: frame.height - 1}}
  end

  defp inspector_widget(%{content: content}, frame) do
    {%Markdown{
       content: content,
       block: %Block{title: "Inspector · Esc to close", borders: [:all]}
     }, %Rect{x: 0, y: 0, width: frame.width, height: frame.height - 1}}
  end

  defp inline_widgets(%{inline_result: nil}), do: []

  defp inline_widgets(frame) do
    [
      {%Paragraph{text: to_string(frame.inline_result)},
       %Rect{x: 0, y: max(frame.height - 3, 0), width: frame.width, height: 2}}
    ]
  end

  defp lane_geometry(:wide, width, 0), do: {0, div(width, 2)}
  defp lane_geometry(:wide, width, 1), do: {div(width, 2), width - div(width, 2)}
  defp lane_geometry(:narrow, width, _index), do: {0, width}

  defp elapsed(nil), do: "—"

  defp elapsed(%DateTime{} = timestamp),
    do: "#{max(DateTime.diff(DateTime.utc_now(), timestamp), 0)}s"
end
