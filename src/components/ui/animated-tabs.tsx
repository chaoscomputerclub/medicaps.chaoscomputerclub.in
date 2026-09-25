"use client";

import * as React from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

/* ─── Tabs Context ────────────────────────────────────────────── */
interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
}
const TabsContext = React.createContext<TabsCtx | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("animated-tabs: must be inside <Tabs>");
  return ctx;
}

/* ─── Panels Context (for passing transition down cleanly) ────── */
interface PanelsCtx {
  activeValue: string;
  transition: Transition | undefined;
}
const PanelsContext = React.createContext<PanelsCtx | null>(null);

/* ─── Tabs Root ────────────────────────────────────────────────── */
interface TabsProps {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  layoutId?: string | undefined;
}

function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  children,
  className,
  layoutId: customLayoutId,
}: TabsProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? (controlledValue as string) : internal;
  const reactId = React.useId();
  const layoutId = customLayoutId ?? `tab-pill-${reactId}`;

  const setValue = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternal(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ value, setValue, layoutId }}>
      <div className={cn("flex flex-col gap-4", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

/* ─── TabsList ─────────────────────────────────────────────────── */
interface TabsListProps {
  children: React.ReactNode;
  className?: string | undefined;
}

function TabsList({ children, className }: TabsListProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex items-center rounded-xl bg-black border border-white/10 p-1 gap-0.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ─── TabsTab ──────────────────────────────────────────────────── */
interface TabsTabProps {
  value: string;
  children: React.ReactNode;
  className?: string | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
}

function TabsTab({ value, children, className, disabled, id }: TabsTabProps) {
  const { value: activeValue, setValue, layoutId } = useTabs();
  const isActive = activeValue === value;

  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={isActive}
      disabled={disabled}
      onClick={() => {
        if (!disabled) setValue(value);
      }}
      className={cn(
        "relative z-10 flex items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap",
        "transition-colors duration-150 cursor-pointer select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400",
        "disabled:pointer-events-none disabled:opacity-40",
        isActive ? "text-black font-bold" : "text-zinc-400 hover:text-white",
        className,
      )}
    >
      {/* Spring-animated sliding lime pill */}
      {isActive && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 rounded-lg bg-lime-400 shadow-sm"
          style={{ zIndex: -1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      {children}
    </button>
  );
}

/* ─── TabsPanels ───────────────────────────────────────────────── */
interface TabsPanelsProps {
  children: React.ReactNode;
  className?: string | undefined;
  transition?: Transition | undefined;
}

function TabsPanels({ children, className, transition }: TabsPanelsProps) {
  const { value } = useTabs();

  return (
    <PanelsContext.Provider value={{ activeValue: value, transition }}>
      <div className={cn("relative", className)}>
        <AnimatePresence mode="wait" initial={false}>
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return null;
            const props = child.props as { value?: string };
            if (props.value !== value) return null;
            // Render with a stable key so AnimatePresence can track it
            return React.cloneElement(child, { key: props.value ?? "panel" });
          })}
        </AnimatePresence>
      </div>
    </PanelsContext.Provider>
  );
}

/* ─── TabsPanel ────────────────────────────────────────────────── */
interface TabsPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string | undefined;
}

function TabsPanel({ children, className }: TabsPanelProps) {
  const ctx = React.useContext(PanelsContext);
  const panelTransition: Transition = ctx?.transition ?? {
    duration: 0.22,
    ease: [0.25, 0.1, 0.25, 1],
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={panelTransition}
      className={cn("w-full", className)}
    >
      {children}
    </motion.div>
  );
}

export { Tabs, TabsList, TabsTab, TabsPanels, TabsPanel };
