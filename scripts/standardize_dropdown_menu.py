import os
import re

# 1. Update src/components/ui/dropdown-menu.tsx
dropdown_menu_code = '''import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { Check, ChevronRight, Circle } from "lucide-react"

import { cn } from "@/lib/utils"

const DropdownMenu = DropdownMenuPrimitive.Root

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs font-sans outline-none transition-colors hover:bg-white/5 hover:text-[#B1FA63] focus:bg-white/5 focus:text-[#B1FA63] data-[state=open]:bg-white/5 data-[state=open]:text-[#B1FA63] [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto size-3" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    className={cn(
      "z-50 min-w-[8rem] overflow-hidden rounded-[10px] border border-white/10 bg-[#1F1F1F] p-1.5 text-zinc-100 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
      className
    )}
    {...props}
  />
))
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    container?: HTMLElement | null
  }
>(({ className, sideOffset = 4, container, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal container={container}>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-h-[var(--radix-dropdown-menu-content-available-height)] min-w-[8rem] overflow-y-auto overflow-x-hidden rounded-[10px] border border-white/10 bg-[#1F1F1F] p-1.5 text-zinc-100 shadow-xl backdrop-blur-md",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-dropdown-menu-content-transform-origin]",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-[6px] px-2.5 py-1.5 text-xs font-sans outline-none transition-colors hover:bg-white/5 hover:text-[#B1FA63] focus:bg-white/5 focus:text-[#B1FA63] data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-3.5 [&>svg]:shrink-0",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-[6px] py-1.5 pl-8 pr-2.5 text-xs font-sans outline-none transition-colors hover:bg-white/5 hover:text-[#B1FA63] focus:bg-white/5 focus:text-[#B1FA63] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-3.5 w-3.5 text-lime-400" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-[6px] py-1.5 pl-8 pr-2.5 text-xs font-sans outline-none transition-colors hover:bg-white/5 hover:text-[#B1FA63] focus:bg-white/5 focus:text-[#B1FA63] data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-lime-400 text-lime-400" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn(
      "px-2.5 py-1.5 text-xs font-sans font-semibold uppercase tracking-wider text-zinc-400",
      inset && "pl-8",
      className
    )}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-white/10", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  )
}
DropdownMenuShortcut.displayName = "DropdownMenuShortcut"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
'''

with open('src/components/ui/dropdown-menu.tsx', 'w') as f:
    f.write(dropdown_menu_code)
print("Updated src/components/ui/dropdown-menu.tsx successfully")

# 2. Update src/pages/ContestArenaPage.tsx
arena_path = 'src/pages/ContestArenaPage.tsx'
with open(arena_path, 'r') as f:
    arena_content = f.read()

# Remove Select imports from ContestArenaPage
select_import_regex = re.compile(r'import\s*{\s*Select,\s*SelectContent,\s*SelectItem,\s*SelectTrigger,\s*SelectValue,?\s*}\s*from\s*"@/components/ui/select";\n?')
arena_content = select_import_regex.sub('', arena_content)

# Replace the Select component block with DropdownMenu parent-child
old_select_block = '''              {/* Language Selector */}
              <Select
                value={selectedLanguage}
                onValueChange={(val: any) => handleSelectLanguage(val)}
              >
                <SelectTrigger className="h-6 w-[120px] text-xs font-sans bg-[#171717] border-white/15 text-zinc-200 hover:border-lime-400/60 rounded focus:ring-1 focus:ring-lime-400">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1F1F1F] border-white/15 text-white font-sans text-xs rounded-md">
                  <SelectItem value="python">Python 3</SelectItem>
                  <SelectItem value="cpp">C++</SelectItem>
                  <SelectItem value="c">C</SelectItem>
                  <SelectItem value="java">Java</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                </SelectContent>
              </Select>'''

new_dropdown_block = '''              {/* Language Selector (Parent-Child DropdownMenu) */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-0 h-7 px-2.5 text-xs font-sans gap-1.5 rounded-[8px]"
                    title="Select Programming Language"
                  >
                    <span>
                      {ARENA_LANGUAGES.find((l) => l.value === selectedLanguage)?.label || selectedLanguage}
                    </span>
                    <ChevronDown className="size-3 text-zinc-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="bg-[#1F1F1F] border-white/10 text-white text-xs font-sans rounded-[10px] min-w-[140px] p-1.5"
                >
                  {ARENA_LANGUAGES.map((lang) => (
                    <DropdownMenuItem
                      key={lang.value}
                      onClick={() => handleSelectLanguage(lang.value)}
                      className={`cursor-pointer flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-[6px] text-xs font-sans transition-colors ${
                        selectedLanguage === lang.value
                          ? "text-lime-400 font-semibold bg-white/5"
                          : "text-zinc-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span>{lang.label}</span>
                      {selectedLanguage === lang.value && (
                        <Check className="size-3.5 text-lime-400 shrink-0" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>'''

if old_select_block in arena_content:
    arena_content = arena_content.replace(old_select_block, new_dropdown_block)
    print("Replaced Select with DropdownMenu in ContestArenaPage.tsx")
else:
    # Try flexible replacement
    pattern = re.compile(r'{\s*/\*\s*Language Selector\s*\*/\s*}\s*<Select[\s\S]*?</Select>', re.MULTILINE)
    if pattern.search(arena_content):
        arena_content = pattern.sub(new_dropdown_block, arena_content)
        print("Replaced Select with DropdownMenu via regex in ContestArenaPage.tsx")
    else:
        print("WARNING: Could not find Select block in ContestArenaPage.tsx")

with open(arena_path, 'w') as f:
    f.write(arena_content)
print("Updated ContestArenaPage.tsx successfully")
