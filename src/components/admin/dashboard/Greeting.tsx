"use client";

import { useEffect, useState } from "react";

function phrase(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

/** Greets by the visitor's own clock (the server's clock is in another time zone). */
export function Greeting({ name, initialHour }: { name: string; initialHour: number }) {
  const [text, setText] = useState(phrase(initialHour));
  useEffect(() => setText(phrase(new Date().getHours())), []);
  return (
    <h1>
      {text}, {name} <span aria-hidden="true">👋</span>
    </h1>
  );
}
