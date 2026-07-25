import type { TimelineDocument, TimelineElement, TimelineOperation } from "./types";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function updateElement(
  timeline: TimelineDocument,
  elementId: string,
  patch: Partial<TimelineElement>
): TimelineDocument {
  return {
    ...timeline,
    tracks: timeline.tracks.map((track) => ({
      ...track,
      elements: track.elements.map((element) =>
        element.id === elementId
          ? {
              ...element,
              ...patch,
              start: clamp(patch.start ?? element.start, 0, timeline.duration - 0.1),
              duration: clamp(patch.duration ?? element.duration, 0.1, timeline.duration)
            }
          : element
      )
    }))
  };
}

export function applyTimelineOperation(
  timeline: TimelineDocument,
  operation: TimelineOperation
): TimelineDocument {
  switch (operation.type) {
    case "element.insert":
      return {
        ...timeline,
        tracks: timeline.tracks.map((track) =>
          track.id === operation.trackId
            ? { ...track, elements: [...track.elements, operation.element] }
            : track
        )
      };
    case "element.update":
      return updateElement(timeline, operation.elementId, operation.patch);
    case "element.remove":
      return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          elements: track.elements.filter((element) => element.id !== operation.elementId)
        }))
      };
    case "track.update":
      return {
        ...timeline,
        tracks: timeline.tracks.map((track) =>
          track.id === operation.trackId ? { ...track, ...operation.patch } : track
        )
      };
    case "element.split": {
      const source = timeline.tracks.flatMap((track) => track.elements).find((item) => item.id === operation.elementId);
      if (!source || operation.at <= source.start || operation.at >= source.start + source.duration) return timeline;
      const firstDuration = operation.at - source.start;
      const secondDuration = source.duration - firstDuration;
      return {
        ...timeline,
        tracks: timeline.tracks.map((track) => ({
          ...track,
          elements: track.elements.flatMap((element) =>
            element.id === source.id
              ? [
                  { ...element, duration: firstDuration },
                  {
                    ...element,
                    id: `${element.id}-split-${Math.round(operation.at * 100)}`,
                    name: `${element.name} · B`,
                    start: operation.at,
                    duration: secondDuration,
                    sourceStart: (element.sourceStart ?? 0) + firstDuration
                  }
                ]
              : [element]
          )
        }))
      };
    }
  }
}

export function applyTimelineOperations(
  timeline: TimelineDocument,
  operations: TimelineOperation[]
): TimelineDocument {
  return operations.reduce(applyTimelineOperation, timeline);
}
