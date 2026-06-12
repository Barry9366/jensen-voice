import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Graceful fallback for local development without environment tokens
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn(
      "[Jensen Voice API] BLOB_READ_WRITE_TOKEN environment variable is not set. Simulating upload for offline development."
    );
    
    try {
      const formData = await request.formData();
      const file = formData.get("file") as File;
      const filename = file ? file.name : "recording.webm";
      
      // Return a simulated cloud URL
      return NextResponse.json({
        url: `https://mock-vercel-blob.com/jensen-voice/${Date.now()}-${filename}`,
        message: "Offline simulated upload successful",
        mocked: true,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: "Failed to parse form data: " + message },
        { status: 400 }
      );
    }
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided in form data" },
        { status: 400 }
      );
    }

    const filename = file.name || `recording-${Date.now()}.webm`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
    });

    return NextResponse.json(blob);
  } catch (error) {
    console.error("[Jensen Voice API] Upload error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Upload failed: " + message },
      { status: 500 }
    );
  }
}
