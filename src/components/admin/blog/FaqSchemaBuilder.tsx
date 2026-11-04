"use client";

import { useState } from "react";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface FaqSchemaBuilderProps {
  value: FaqItem[];
  onChange: (items: FaqItem[]) => void;
}

export function FaqSchemaBuilder({ value, onChange }: FaqSchemaBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function addFaq() {
    const newId = `faq-${Date.now()}`;
    onChange([...value, { id: newId, question: "", answer: "" }]);
  }

  function removeFaq(id: string) {
    onChange(value.filter((item) => item.id !== id));
  }

  function updateFaq(id: string, field: "question" | "answer", text: string) {
    onChange(
      value.map((item) =>
        item.id === id ? { ...item, [field]: text } : item
      )
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">FAQ Schema</h3>
        <button
          type="button"
          onClick={addFaq}
          className="flex items-center gap-1 rounded-md bg-crimson px-2 py-1 text-xs font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      <div className="bg-card border border-border rounded-md p-4 space-y-1.5">
        {value.map((faq, index) => (
          <div key={faq.id} className="rounded-md border border-border bg-surface">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === faq.id ? null : faq.id)}
              className="flex w-full items-center justify-between gap-2 p-2 text-left hover:bg-surface/80"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted">Q{index + 1}</p>
                <p className="truncate text-xs text-foreground font-medium">
                  {faq.question || "Enter question…"}
                </p>
              </div>
              {expandedId === faq.id ? (
                <ChevronUp className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
              )}
            </button>

            {expandedId === faq.id && (
              <div className="border-t border-border p-2 space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Question</label>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                    placeholder="What is the question?"
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">Answer</label>
                  <textarea
                    value={faq.answer}
                    onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                    placeholder="Answer…"
                    rows={2}
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20 resize-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeFaq(faq.id)}
                  className="flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            )}
          </div>
        ))}

        {value.length === 0 && (
          <p className="py-2 text-center text-xs text-muted">No FAQs yet</p>
        )}
      </div>
    </div>
  );
}
