import { NextResponse } from "next/server";
import { robotState } from "@/lib/robot-state";

export async function POST() {
    await robotState.reset();
    return NextResponse.json(robotState.get());
}
