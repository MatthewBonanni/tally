import { Construction } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { PageContainer } from "@/components/layout/PageContainer";

interface PlaceholderProps {
  title: string;
}

export function Placeholder({ title }: PlaceholderProps) {
  return (
    <>
      <Header title={title} />
      <PageContainer>
        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
          <Construction className="h-16 w-16 mb-4 opacity-30" />
          <h2 className="text-xl font-semibold mb-2">{title}</h2>
          <p className="text-sm">This feature is coming soon</p>
        </div>
      </PageContainer>
    </>
  );
}
