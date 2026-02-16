import { describe, it, expect, vi, beforeEach } from "vitest"
import { copyToClipboard } from "../clipboard"

describe("copyToClipboard", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("uses navigator.clipboard.writeText when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    const result = await copyToClipboard("hello")
    expect(writeText).toHaveBeenCalledWith("hello")
    expect(result).toBe(true)
  })

  it("falls back to textarea when clipboard API fails", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("not allowed")),
      },
    })
    const execCommand = vi.fn().mockReturnValue(true)
    document.execCommand = execCommand

    const result = await copyToClipboard("test")
    expect(execCommand).toHaveBeenCalledWith("copy")
    expect(result).toBe(true)
  })

  it("returns false when both methods fail", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("not allowed")),
      },
    })
    document.execCommand = vi.fn().mockImplementation(() => {
      throw new Error("not supported")
    })

    const result = await copyToClipboard("test")
    expect(result).toBe(false)
  })
})
