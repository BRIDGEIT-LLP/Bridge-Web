import React from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
            <Card padding="lg" className="w-full max-w-md text-center flex flex-col items-center gap-6">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-container/20 text-primary">
                    <Icon name="explore_off" size={36} />
                </div>

                <div className="space-y-2">
                    <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
                        404
                    </h1>
                    <h2 className="font-headline text-xl font-bold text-on-surface">
                        Page Not Found
                    </h2>
                    <p className="text-sm text-on-surface-variant leading-relaxed">
                        The route you are looking for is not available or might have been moved.
                    </p>
                </div>

                <div className="w-full pt-2">
                    <Button variant="secondary" href="/dashboard" className="w-full" leadingIcon="arrow_back">
                        Back to Dashboard
                    </Button>
                </div>
            </Card>
        </div>
    );
}
