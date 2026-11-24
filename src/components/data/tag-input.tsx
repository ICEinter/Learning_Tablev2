"use client";
import { useId, useState, type KeyboardEvent } from "react";

/** ช่องกรอกแท็ก (เช่น อุปกรณ์) — Enter หรือ , เพื่อเพิ่ม, Backspace ลบรายการสุดท้าย */
export function TagInput({
  id,
  value,
  onChange,
  suggestions = [],
  placeholder = "พิมพ์แล้วกด Enter",
}: {
  id?: string;
  value: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const t = raw.replace(/,/g, " ").trim();
    if (!t) return;
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(text);
    } else if (e.key === "Backspace" && text === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  const remaining = suggestions.filter((s) => !value.includes(s));

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-line bg-page px-2 py-0.5 text-xs">
          {tag}
          <button type="button" className="rounded text-muted hover:text-danger" aria-label={`ลบ ${tag}`} onClick={() => onChange(value.filter((v) => v !== tag))}>
            ✕
          </button>
        </span>
      ))}
      <input
        id={id}
        list={remaining.length ? listId : undefined}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(text)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
      />
      {remaining.length > 0 && (
        <datalist id={listId}>
          {remaining.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
    </div>
  );
}
