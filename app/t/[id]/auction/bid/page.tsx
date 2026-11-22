import AuctionPage from "@/components/AuctionPage";
export default function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ a?: string; code?: string }> }) {
  return <AuctionPage {...props} mode="bid" />;
}
