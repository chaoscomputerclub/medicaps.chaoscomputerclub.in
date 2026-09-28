import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-zinc-950 group-[.toaster]:text-white group-[.toaster]:border-white/10 group-[.toaster]:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.12)]",
          description: "group-[.toast]:text-zinc-400",
          actionButton: "group-[.toast]:bg-lime-400 group-[.toast]:text-black",
          cancelButton: "group-[.toast]:bg-zinc-900 group-[.toast]:text-zinc-300",
          closeButton: "group-[.toast]:text-zinc-500 hover:text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };