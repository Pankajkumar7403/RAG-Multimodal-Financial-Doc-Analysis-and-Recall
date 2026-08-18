import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UploadDocument } from "@/components/workspace/upload-document";

describe("UploadDocument", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("prevents non-PDF uploads before sending a request", async () => {
    const user = userEvent.setup();
    render(<UploadDocument onUploaded={vi.fn()} />);
    await user.upload(
      screen.getByLabelText(/upload pdf/i),
      new File(["x"], "notes.txt", { type: "text/plain" })
    );

    expect(
      screen.getByText("Only PDF documents can be uploaded.")
    ).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });
});
