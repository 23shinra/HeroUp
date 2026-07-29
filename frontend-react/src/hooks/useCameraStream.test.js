import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCameraStream } from "./useCameraStream.js";

describe("useCameraStream", () => {
  let tracks;

  beforeEach(() => {
    tracks = [{ stop: vi.fn() }];
    const stream = { getTracks: () => tracks };
    navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
    };
  });

  afterEach(() => {
    delete navigator.mediaDevices;
  });

  it("starts and stops tracks on unmount", async () => {
    const { result, unmount } = renderHook(() => useCameraStream());
    expect(result.current.status).toBe("idle");

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("live");
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();

    unmount();
    expect(tracks[0].stop).toHaveBeenCalled();
  });

  it("maps permission denial", async () => {
    navigator.mediaDevices.getUserMedia = vi.fn().mockRejectedValue(
      Object.assign(new Error("denied"), { name: "NotAllowedError" }),
    );
    const { result } = renderHook(() => useCameraStream());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("denied");
    expect(result.current.error).toMatch(/доступа к камере/i);
  });
});
