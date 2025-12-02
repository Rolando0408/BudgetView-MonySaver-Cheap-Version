import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
    className?: string;
    textClassName?: string;
    title?: string;
    subtitle?: string;
};

export function Logo({ className, textClassName, title = "Budgetview", subtitle = "MonySaver" }: LogoProps) {
    return (
        <div className={cn("flex items-center gap-0", className)}>
            <Image
                src="/images/logoBV.png"
                alt="Logo de BudgetView"
                width={45}
                height={30}
                className="object-contain"
                priority
            />
            <div className={cn("ml-2", textClassName)}>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {subtitle}
                </p>
                <p className="text-2xl font-semibold leading-tight tracking-tight">
                    {title}
                </p>
            </div>
        </div>
    );
}