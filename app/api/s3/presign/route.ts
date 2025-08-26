import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const runtime = "nodejs";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const filename = url.searchParams.get("filename");
    const contentType =
      url.searchParams.get("type") || "application/octet-stream";
    const sessionId = url.searchParams.get("sessionId") || "misc";

    if (!filename) {
      return NextResponse.json({ error: "Missing filename" }, { status: 400 });
    }
    if (!process.env.S3_BUCKET) {
      return NextResponse.json({ error: "Missing S3_BUCKET" }, { status: 500 });
    }

    // e.g. sess_abc/1699999999999_report.pdf
    const key = `${sessionId}/${Date.now()}_${filename}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "private",
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
    return NextResponse.json({ uploadUrl, key });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}