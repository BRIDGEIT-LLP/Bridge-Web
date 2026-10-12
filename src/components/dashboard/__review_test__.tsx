"use client";

// TEMP: throwaway component used only to exercise the automated PR review
// workflow (it intentionally violates project conventions so the reviewer
// has something to flag). Remove before merging.

import { useEffect, useState } from "react";
import axios from "axios";

export default function ReviewTestWidget() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    axios
      .get("http://localhost:8000/api/v1/connections/count")
      .then((res) => setCount(res.data.count))
      .catch(() => setCount(0));
  }, []);

  return <div className="text-sm">{count ?? "…"}</div>;
}
