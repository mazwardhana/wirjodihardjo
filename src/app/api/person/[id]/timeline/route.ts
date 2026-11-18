import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { buildLifeTimeline, buildTimelinePoints, type TimelineEvent } from "@/lib/timeline";

// uuid-ish: bentuk UUID standar sudah cukup sebagai gerbang murah sebelum
// menyentuh database; keunikan tetap diperiksa Prisma.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function serialize(events: TimelineEvent[]) {
  return events.map((event) => ({ ...event, date: event.date ? event.date.toISOString() : null }));
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "id tidak valid" }, { status: 400 });
  }

  const session = await auth();
  const isGuest = !session?.user;

  const person = await prisma.person.findFirst({
    where: { id, deletedAt: null, isPublicProfile: true },
    select: {
      id: true,
      birthDate: true,
      birthPlace: true,
      deathDate: true,
      deathPlace: true,
      isDeceased: true,
      lifeEvents: {
        orderBy: { date: "asc" },
        select: {
          id: true, kind: true, title: true, description: true, locationName: true,
          latitude: true, longitude: true, date: true, datePrecision: true,
        },
      },
      education: {
        orderBy: { startYear: "asc" },
        select: {
          id: true, institution: true, degree: true, fieldOfStudy: true, startYear: true, endYear: true,
        },
      },
    },
  });
  if (!person) {
    return NextResponse.json({ error: "Orang tidak ditemukan" }, { status: 404 });
  }

  const { events } = buildLifeTimeline({
    person: {
      id: person.id,
      birthDate: person.birthDate,
      birthPlace: person.birthPlace,
      deathDate: person.deathDate,
      deathPlace: person.deathPlace,
      isDeceased: person.isDeceased,
    },
    lifeEvents: person.lifeEvents,
    education: person.education,
  });

  // Tamu hanya boleh melihat peristiwa publik. Event berkordinat tetap tampil
  // karena dipakai peta, tetapi narasinya dipangkas. Titik peta diturunkan
  // dari event yang sudah lolos filter, jadi tidak ada kebocoran lewat peta.
  let visible = events;
  if (isGuest) {
    visible = events
      .filter((event) =>
        event.kind === "BIRTH" ||
        event.kind === "DEATH" ||
        event.kind === "EDUCATION" ||
        ((event.kind === "CUSTOM" || event.kind === "MARRIAGE" || event.kind === "OCCUPATION") &&
          event.latitude !== null && event.longitude !== null),
      )
      .map((event) =>
        event.kind === "EDUCATION" || event.kind === "CUSTOM" || event.kind === "OCCUPATION"
          ? { ...event, description: null }
          : event,
      );
  }

  const response = NextResponse.json({ events: serialize(visible), points: buildTimelinePoints(visible) });
  response.headers.set("Cache-Control", isGuest ? "public, max-age=300" : "private, max-age=0");
  return response;
}
