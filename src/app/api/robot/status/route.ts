import { NextResponse } from "next/server";
import { robotState } from "@/lib/robot-state";

export async function GET() {
    return NextResponse.json(robotState.get());
}
