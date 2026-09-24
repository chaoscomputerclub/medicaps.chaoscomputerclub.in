'use client';

import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '@/lib/utils';

export type AlertDialogFlipDirection = 'top' | 'bottom' | 'left' | 'right';

type AlertDialogContextType = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
};

const AlertDialogContext = React.createContext<AlertDialogContextType | null>(null);

export function useAlertDialog() {
  const context = React.useContext(AlertDialogContext);
  if (!context) {
    throw new Error('useAlertDialog must be used within an AlertDialog');
  }
  return context;
}

export type AlertDialogProps = React.ComponentProps<typeof AlertDialogPrimitive.Root>;

export function AlertDialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const setIsOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  return (
    <AlertDialogContext.Provider value={{ isOpen, setIsOpen }}>
      <AlertDialogPrimitive.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Root>
    </AlertDialogContext.Provider>
  );
}

export type AlertDialogTriggerProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Trigger
>;

export const AlertDialogTrigger = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Trigger>,
  AlertDialogTriggerProps
>(({ ...props }, ref) => (
  <AlertDialogPrimitive.Trigger ref={ref} data-slot="alert-dialog-trigger" {...props} />
));
AlertDialogTrigger.displayName = 'AlertDialogTrigger';

export type AlertDialogPortalProps = Omit<
  React.ComponentProps<typeof AlertDialogPrimitive.Portal>,
  'forceMount'
>;

export function AlertDialogPortal({ children, ...props }: AlertDialogPortalProps) {
  const { isOpen } = useAlertDialog();

  return (
    <AnimatePresence>
      {isOpen && (
        <AlertDialogPrimitive.Portal forceMount {...props}>
          {children}
        </AlertDialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

export type AlertDialogBackdropProps = Omit<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>,
  'asChild'
> &
  HTMLMotionProps<'div'>;

export const AlertDialogBackdrop = React.forwardRef<HTMLDivElement, AlertDialogBackdropProps>(
  (
    {
      className,
      transition = { duration: 0.2, ease: 'easeInOut' },
      ...props
    },
    ref,
  ) => {
    return (
      <AlertDialogPrimitive.Overlay asChild forceMount>
        <motion.div
          ref={ref}
          key="alert-dialog-backdrop"
          data-slot="alert-dialog-backdrop"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={transition}
          className={cn('fixed inset-0 z-50 bg-black/80', className)}
          {...props}
        />
      </AlertDialogPrimitive.Overlay>
    );
  },
);
AlertDialogBackdrop.displayName = 'AlertDialogBackdrop';

// Backwards-compatible alias for Backdrop
export const AlertDialogOverlay = AlertDialogBackdrop;

export type AlertDialogPopupProps = Omit<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>,
  'asChild'
> &
  HTMLMotionProps<'div'> & {
    from?: AlertDialogFlipDirection;
  };

export const AlertDialogPopup = React.forwardRef<HTMLDivElement, AlertDialogPopupProps>(
  (
    {
      className,
      from = 'top',
      transition = { type: 'spring', stiffness: 150, damping: 25 },
      ...props
    },
    ref,
  ) => {
    const initialRotation =
      from === 'bottom' || from === 'left' ? '20deg' : '-20deg';
    const isVertical = from === 'top' || from === 'bottom';
    const rotateAxis = isVertical ? 'rotateX' : 'rotateY';

    return (
      <AlertDialogPrimitive.Content asChild forceMount>
        <motion.div
          ref={ref}
          key="alert-dialog-popup"
          data-slot="alert-dialog-popup"
          initial={{
            opacity: 0,
            filter: 'blur(4px)',
            transform: `perspective(500px) ${rotateAxis}(${initialRotation}) scale(0.8)`,
          }}
          animate={{
            opacity: 1,
            filter: 'blur(0px)',
            transform: `perspective(500px) ${rotateAxis}(0deg) scale(1)`,
          }}
          exit={{
            opacity: 0,
            filter: 'blur(4px)',
            transform: `perspective(500px) ${rotateAxis}(${initialRotation}) scale(0.8)`,
          }}
          transition={transition}
          className={cn(
            'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-2xl rounded-lg',
            className,
          )}
          {...props}
        />
      </AlertDialogPrimitive.Content>
    );
  },
);
AlertDialogPopup.displayName = 'AlertDialogPopup';

// Alias Content to Popup for drop-in flexibility
export const AlertDialogContent = AlertDialogPopup;

export type AlertDialogCloseProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Cancel
>;

export const AlertDialogClose = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  AlertDialogCloseProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    data-slot="alert-dialog-close"
    className={className}
    {...props}
  />
));
AlertDialogClose.displayName = 'AlertDialogClose';

export const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentProps<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action
    ref={ref}
    data-slot="alert-dialog-action"
    className={className}
    {...props}
  />
));
AlertDialogAction.displayName = 'AlertDialogAction';

export const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentProps<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    data-slot="alert-dialog-cancel"
    className={className}
    {...props}
  />
));
AlertDialogCancel.displayName = 'AlertDialogCancel';

export type AlertDialogHeaderProps = React.ComponentProps<'div'>;

export function AlertDialogHeader({ className, ...props }: AlertDialogHeaderProps) {
  return (
    <div
      data-slot="alert-dialog-header"
      className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
      {...props}
    />
  );
}

export type AlertDialogFooterProps = React.ComponentProps<'div'>;

export function AlertDialogFooter({ className, ...props }: AlertDialogFooterProps) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
      {...props}
    />
  );
}

export type AlertDialogTitleProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Title
>;

export const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  AlertDialogTitleProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    data-slot="alert-dialog-title"
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = 'AlertDialogTitle';

export type AlertDialogDescriptionProps = React.ComponentProps<
  typeof AlertDialogPrimitive.Description
>;

export const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  AlertDialogDescriptionProps
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    data-slot="alert-dialog-description"
    className={cn('text-sm text-zinc-400', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = 'AlertDialogDescription';

type BaseAlertDialogDemoProps = {
  from?: AlertDialogFlipDirection;
};

export const BaseAlertDialogDemo = ({ from = 'top' }: BaseAlertDialogDemoProps) => {
  return (
    <AlertDialog>
      <AlertDialogTrigger className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md">
        Open Dialog
      </AlertDialogTrigger>

      <AlertDialogPortal>
        <AlertDialogBackdrop className="fixed inset-0 z-50 bg-black/80" />
        <AlertDialogPopup
          from={from}
          className="sm:max-w-md fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] z-50 border bg-background p-6"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">
              Are you absolutely sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This action cannot be undone. This will permanently delete your
              account and remove your data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter className="mt-4 flex justify-end gap-2">
            <AlertDialogClose className="bg-accent text-accent-foreground px-4 py-2 text-sm rounded-md">
              Cancel
            </AlertDialogClose>
            <AlertDialogClose className="bg-primary text-primary-foreground px-4 py-2 text-sm rounded-md">
              Continue
            </AlertDialogClose>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialogPortal>
    </AlertDialog>
  );
};
