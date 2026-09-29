"use client";

import * as React from "react";
import { motion, AnimatePresence, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

/* ─── Tabs Context ────────────────────────────────────────────── */
interface TabItemMeta {
  value: string;
  ref: HTMLButtonElement | null;
  disabled?: boolean | undefined;
}

interface TabsCtx {
  value: string;
  setValue: (v: string) => void;
  layoutId: string;
  baseId: string;
  orientation: "horizontal" | "vertical";
  registerTab: (meta: TabItemMeta) => void;
  unregisterTab: (value: string) => void;
  tabMetaMap: React.MutableRefObject<Map<string, TabItemMeta>>;
}

const TabsContext = React.createContext<TabsCtx | null>(null);

export function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs: must be used within a <Tabs> container");
  }
  return ctx;
}

/* ─── Panels Context ───────────────────────────────────────────── */
interface PanelsCtx {
  activeValue: string;
  transition: Transition | undefined;
}

const PanelsContext = React.createContext<PanelsCtx | null>(null);

/* ─── Tabs Root ────────────────────────────────────────────────── */
export interface TabsProps {
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  orientation?: "horizontal" | "vertical" | undefined;
  children: React.ReactNode;
  className?: string | undefined;
  layoutId?: string | undefined;
}

export function Tabs({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  orientation = "horizontal",
  children,
  className,
  layoutId: customLayoutId,
}: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? (controlledValue as string) : internalValue;

  const reactId = React.useId();
  const baseId = `tab-system-${reactId}`;
  const layoutId = customLayoutId ?? `tab-pill-${reactId}`;

  const tabMetaMap = React.useRef<Map<string, TabItemMeta>>(new Map());

  const registerTab = React.useCallback((meta: TabItemMeta) => {
    tabMetaMap.current.set(meta.value, meta);
  }, []);

  const unregisterTab = React.useCallback((val: string) => {
    tabMetaMap.current.delete(val);
  }, []);

  const setValue = React.useCallback(
    (nextVal: string) => {
      if (!isControlled) {
        setInternalValue(nextVal);
      }
      onValueChange?.(nextVal);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsContext.Provider
      value={{
        value,
        setValue,
        layoutId,
        baseId,
        orientation,
        registerTab,
        unregisterTab,
        tabMetaMap,
      }}
    >
      <div
        className={cn(
          "flex",
          orientation === "vertical" ? "flex-row gap-6" : "flex-col gap-4",
          className,
        )}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/* ─── TabsList ─────────────────────────────────────────────────── */
export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string | undefined;
  loop?: boolean | undefined;
}

export function TabsList({
  children,
  className,
  loop = true,
  onKeyDown,
  ...props
}: TabsListProps) {
  const { value, setValue, orientation, tabMetaMap } = useTabs();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    const isHorizontal = orientation === "horizontal";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";

    if (e.key !== nextKey && e.key !== prevKey && e.key !== "Home" && e.key !== "End") {
      return;
    }

    const tabs = Array.from(tabMetaMap.current.values()).filter((t) => !t.disabled);
    if (tabs.length === 0) return;

    const currentIndex = tabs.findIndex((t) => t.value === value);
    let targetIndex = currentIndex;

    if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = tabs.length - 1;
    } else if (e.key === nextKey) {
      if (currentIndex === -1) {
        targetIndex = 0;
      } else if (currentIndex < tabs.length - 1) {
        targetIndex = currentIndex + 1;
      } else if (loop) {
        targetIndex = 0;
      }
    } else if (e.key === prevKey) {
      if (currentIndex === -1) {
        targetIndex = tabs.length - 1;
      } else if (currentIndex > 0) {
        targetIndex = currentIndex - 1;
      } else if (loop) {
        targetIndex = tabs.length - 1;
      }
    }

    const targetTab = tabs[targetIndex];
    if (targetTab && targetIndex !== currentIndex) {
      e.preventDefault();
      setValue(targetTab.value);
      targetTab.ref?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-orientation={orientation}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex items-center rounded-lg bg-black border border-white/10 p-1 gap-0.5",
        orientation === "vertical" && "flex-col items-stretch",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── TabsTab ──────────────────────────────────────────────────── */
export interface TabsTabProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string;
  children: React.ReactNode;
  className?: string | undefined;
  activeClassName?: string | undefined;
  inactiveClassName?: string | undefined;
  indicatorClassName?: string | undefined;
  disabled?: boolean | undefined;
  id?: string | undefined;
}

export function TabsTab({
  value,
  children,
  className,
  activeClassName,
  inactiveClassName,
  indicatorClassName,
  disabled,
  id: customId,
  onClick,
  ...props
}: TabsTabProps) {
  const { value: activeValue, setValue, layoutId, baseId, registerTab, unregisterTab } =
    useTabs();
  const isActive = activeValue === value;
  const tabRef = React.useRef<HTMLButtonElement | null>(null);

  React.useEffect(() => {
    registerTab({ value, ref: tabRef.current, disabled });
    return () => {
      unregisterTab(value);
    };
  }, [value, disabled, registerTab, unregisterTab]);

  const tabId = customId ?? `${baseId}-tab-${value}`;
  const panelId = `${baseId}-panel-${value}`;

  return (
    <button
      ref={tabRef}
      id={tabId}
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={panelId}
      tabIndex={isActive ? 0 : -1}
      disabled={disabled}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !disabled) {
          setValue(value);
        }
      }}
      className={cn(
        "relative z-10 flex items-center justify-center gap-2 rounded-md px-3 py-1.5 font-sans text-sm font-semibold whitespace-nowrap",
        "transition-colors duration-150 cursor-pointer select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-1 focus-visible:ring-offset-black",
        "disabled:pointer-events-none disabled:opacity-40",
        isActive
          ? (activeClassName ?? "text-black font-semibold")
          : (inactiveClassName ?? "text-zinc-400 hover:text-white"),
        className,
      )}
      {...props}
    >
      {/* Spring-animated sliding pill */}
      {isActive && (
        <motion.span
          layoutId={layoutId}
          className={cn(
            "absolute inset-0 rounded-md bg-lime-400 shadow-sm",
            indicatorClassName,
          )}
          style={{ zIndex: -1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      {children}
    </button>
  );
}

/* ─── TabsPanels ───────────────────────────────────────────────── */
export interface TabsPanelsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string | undefined;
  transition?: Transition | undefined;
}

export function TabsPanels({
  children,
  className,
  transition,
  ...props
}: TabsPanelsProps) {
  const { value } = useTabs();

  return (
    <PanelsContext.Provider value={{ activeValue: value, transition }}>
      <div className={cn("relative w-full", className)} {...props}>
        <AnimatePresence mode="wait" initial={false}>
          {React.Children.map(children, (child) => {
            if (!React.isValidElement(child)) return null;
            const childProps = child.props as { value?: string };
            if (childProps.value !== value) return null;
            return React.cloneElement(child, {
              key: childProps.value ?? "panel",
            } as any);
          })}
        </AnimatePresence>
      </div>
    </PanelsContext.Provider>
  );
}

/* ─── TabsPanel ────────────────────────────────────────────────── */
export interface TabsPanelProps {
  value: string;
  children: React.ReactNode;
  className?: string | undefined;
  id?: string | undefined;
}

export function TabsPanel({
  value,
  children,
  className,
  id: customId,
}: TabsPanelProps) {
  const ctx = React.useContext(PanelsContext);
  const { baseId } = useTabs();

  const panelTransition: Transition = ctx?.transition ?? {
    duration: 0.2,
    ease: [0.25, 0.1, 0.25, 1],
  };

  const panelId = customId ?? `${baseId}-panel-${value}`;
  const tabId = `${baseId}-tab-${value}`;

  return (
    <motion.div
      id={panelId}
      role="tabpanel"
      tabIndex={0}
      aria-labelledby={tabId}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={panelTransition}
      className={cn("w-full focus:outline-none", className)}
    >
      {children}
    </motion.div>
  );
}
