"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnnouncementBar } from "@/components/announcement-bar";
import { SiteHeader } from "@/components/site-header";
import { SiteFooterStatic, STATIC_FOOTER_FALLBACK } from "@/components/site-footer";
import { WhatsAppWidget } from "@/components/whatsapp-widget";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Display } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { ReturnFlowProgress } from "@/components/returns/return-flow-progress";
import { FindOrderForm } from "@/components/returns/find-order-form";
import { ReturnItemsSelector } from "@/components/returns/return-items-selector";
import { ReturnSubmit } from "@/components/returns/return-submit";
import { useReturnsStubStore } from "@/lib/stores/returns-stub-store";
import { findOrderForReturn } from "./_actions";
import type { Order } from "@/lib/schemas";

function InitiateReturnInner() {
  const router = useRouter();
  const params = useSearchParams();
  const step = (Number(params.get("step")) || 1) as 1 | 2 | 3;
  const seedOrderId = params.get("orderId");

  const orderId = useReturnsStubStore((s) => s.orderId);
  const selectedItems = useReturnsStubStore((s) => s.selectedItems);
  const reason = useReturnsStubStore((s) => s.reason);
  const setOrder = useReturnsStubStore((s) => s.setOrder);
  const toggleItem = useReturnsStubStore((s) => s.toggleItem);
  const setReason = useReturnsStubStore((s) => s.setReason);

  const [fetchedOrder, setFetchedOrder] = React.useState<Order | null>(null);
  const [findError, setFindError] = React.useState<string | undefined>();

  // When the customer arrives from /account/orders/<id> we already know which
  // order they want to return — auto-fill it and jump straight to step 2 so
  // they don't have to retype the order number on a 3-step form.
  React.useEffect(() => {
    if (!seedOrderId || orderId === seedOrderId) return;
    setOrder(seedOrderId);
    router.replace("/initiate-return?step=2");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedOrderId]);

  React.useEffect(() => {
    if (!orderId) return;
    let active = true;
    findOrderForReturn(orderId).then((o) => {
      if (active) setFetchedOrder(o);
    });
    return () => {
      active = false;
    };
  }, [orderId]);

  // Derived: only treat fetchedOrder as current when its id matches the store
  const order = fetchedOrder && fetchedOrder.id === orderId ? fetchedOrder : null;

  const handleFind = async (orderNumber: string, _contact: string) => {
    const found = await findOrderForReturn(orderNumber);
    if (!found) {
      setFindError("We couldn't find an order with those details.");
      return;
    }
    setOrder(found.id);
    setFindError(undefined);
    router.push("/initiate-return?step=2");
  };

  const handleSelectComplete = () => {
    router.push("/initiate-return?step=3");
  };

  const handleStartOver = () => {
    useReturnsStubStore.getState().reset();
    router.push("/initiate-return?step=1");
  };

  return (
    <main className="flex-1">
      <Section padding="md">
        <Container size="narrow">
          <Display level="md" as="h1" className="mb-8">Initiate a return</Display>
          <ReturnFlowProgress current={step} />

          <div className="mt-12">
            {step === 1 && <FindOrderForm onSubmit={handleFind} error={findError} />}

            {step === 2 && order && (
              <ReturnItemsSelector
                order={order}
                selectedKeys={selectedItems}
                reason={reason}
                onToggle={toggleItem}
                onReasonChange={setReason}
                onSubmit={handleSelectComplete}
              />
            )}

            {step === 2 && !order && (
              <div className="flex flex-col gap-4">
                <p className="text-[14px] text-foreground-secondary">
                  No order selected. Start over?
                </p>
                <Button variant="outline" onClick={handleStartOver}>Start over</Button>
              </div>
            )}

            {step === 3 && order && (
              <ReturnSubmit
                orderId={order.recordId ?? order.id}
                orderNumber={order.id}
                items={order.items
                  .filter((it) => selectedItems.includes(`${it.productId}-${it.size}`))
                  .filter((it): it is typeof it & { orderItemId: string } =>
                    Boolean(it.orderItemId),
                  )
                  .map((it) => ({ orderItemId: it.orderItemId, quantity: it.quantity }))}
                reason={reason || "(no reason given)"}
              />
            )}
          </div>
        </Container>
      </Section>
    </main>
  );
}

export default function InitiateReturnPage() {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <React.Suspense fallback={null}>
        <InitiateReturnInner />
      </React.Suspense>
      <SiteFooterStatic content={STATIC_FOOTER_FALLBACK} />
      <WhatsAppWidget phone="+44 7000 000000" message="Hi YNOT, I have a question about my return." />
    </>
  );
}
