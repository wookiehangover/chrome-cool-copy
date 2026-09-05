import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAudioFromBlob, generateSpeech, revokeAudioUrl } from "./tts-service.js";
import { TTSError } from "./tts-types.js";

function responseWithBlob(blob: Blob): Response {
  const response = new Response();
  vi.spyOn(response, "blob").mockResolvedValue(blob);
  return response;
}

describe("TTS service", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("throws INVALID_RESPONSE when text is empty", async () => {
    await expect(generateSpeech({ text: "   " })).rejects.toMatchObject({
      name: "TTSError",
      code: "INVALID_RESPONSE",
      message: "Text cannot be empty",
    });
  });

  it("posts text and voice to the TTS endpoint and returns an audio blob", async () => {
    const responseBlob = new Blob(["audio-data"], { type: "audio/wav" });
    fetchMock.mockResolvedValueOnce(responseWithBlob(responseBlob));

    const result = await generateSpeech({
      text: "Hello world",
      voice: "bella",
      serverUrl: "http://tts.example",
    });

    expect(result).toBe(responseBlob);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://tts.example/tts",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    if (!(requestBody instanceof FormData)) throw new Error("Expected FormData request body");
    expect(requestBody.get("text")).toBe("Hello world");
    expect(requestBody.get("voice_url")).toBe("bella");
  });

  it("uses default voice and server URL when options are omitted", async () => {
    const responseBlob = new Blob(["audio-data"], { type: "audio/wav" });
    fetchMock.mockResolvedValueOnce(responseWithBlob(responseBlob));

    await generateSpeech({ text: "Defaults test" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/tts",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    if (!(requestBody instanceof FormData)) throw new Error("Expected FormData request body");
    expect(requestBody.get("voice_url")).toBe("alba");
  });

  it("throws SERVER_UNAVAILABLE for fetch TypeError failures", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(generateSpeech({ text: "Hello" })).rejects.toMatchObject({
      name: "TTSError",
      code: "SERVER_UNAVAILABLE",
    });
  });

  it("throws NETWORK_ERROR for non-fetch network failures", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNRESET"));

    await expect(generateSpeech({ text: "Hello" })).rejects.toMatchObject({
      name: "TTSError",
      code: "NETWORK_ERROR",
      message: expect.stringContaining("ECONNRESET"),
    });
  });

  it("throws SERVER_ERROR when response is not ok", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(generateSpeech({ text: "Hello" })).rejects.toMatchObject({
      name: "TTSError",
      code: "SERVER_ERROR",
      message: "TTS server error: 500 Internal Server Error",
    });
  });

  it("throws INVALID_RESPONSE when server returns an empty blob", async () => {
    fetchMock.mockResolvedValueOnce(responseWithBlob(new Blob()));

    await expect(generateSpeech({ text: "Hello" })).rejects.toMatchObject({
      name: "TTSError",
      code: "INVALID_RESPONSE",
      message: "TTS server returned empty response",
    });
  });

  it("createAudioFromBlob creates Audio with blob URL", () => {
    const createObjectURL = vi.fn(() => "blob:mock-audio");
    const revokeObjectURL = vi.fn();
    const MockAudio = vi.fn(function (this: { src: string }, src: string) {
      this.src = src;
    });

    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("Audio", MockAudio);

    const blob = new Blob(["audio"], { type: "audio/wav" });
    const audio = createAudioFromBlob(blob);

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(MockAudio).toHaveBeenCalledWith("blob:mock-audio");
    expect(audio.src).toBe("blob:mock-audio");
  });

  it("revokeAudioUrl revokes blob URLs", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(),
      revokeObjectURL,
    });

    const audio = document.createElement("audio");
    audio.src = "blob:mock-audio";
    revokeAudioUrl(audio);

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock-audio");
  });

  it("revokeAudioUrl ignores non-blob URLs", () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(),
      revokeObjectURL,
    });

    const audio = document.createElement("audio");
    audio.src = "https://example.com/audio.wav";
    revokeAudioUrl(audio);

    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("throws TTSError instances for TTS errors", async () => {
    fetchMock.mockResolvedValueOnce(responseWithBlob(new Blob()));

    await expect(generateSpeech({ text: "Hello" })).rejects.toBeInstanceOf(TTSError);
  });
});
