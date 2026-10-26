import InvoicePayment from "@/components/invoice-payment";
export default async function PayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <InvoicePayment
      id={id}
      live={process.env.FRAMELEDGER_MODE === "production"}
    />
  );
}
