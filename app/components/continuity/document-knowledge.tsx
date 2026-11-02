import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { toast } from "sonner";
import { knowledgeClaimSchema } from "../../../shared/knowledge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function DocumentKnowledge({
  workspaceId,
  documentId,
  readable,
}: {
  workspaceId: string;
  documentId: string;
  readable: boolean;
}) {
  const t = useT();
  const listing = useActionQuery("list-knowledge", { workspaceId, documentId });
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">
          {t("continuity.knowledgeCaution")}
        </p>
        <Button
          disabled={!readable}
          onClick={() =>
            sendToAgentChat({
              message: t("continuity.knowledgeExtractPrompt"),
              context: JSON.stringify({
                currentPage: "documents",
                activeWorkspaceId: workspaceId,
                selectedDocumentId: documentId,
              }),
              submit: true,
              openSidebar: true,
            })
          }
        >
          {t("continuity.knowledgeExtract")}
        </Button>
      </div>
      {listing.isLoading && <Skeleton className="h-48 w-full" />}
      {listing.isError && (
        <div role="alert">
          <p>
            {actionErrorMessage(listing.error) ??
              t("continuity.knowledgeLoadFailed")}
          </p>
          <Button variant="outline" onClick={() => void listing.refetch()}>
            {t("continuity.retry")}
          </Button>
        </div>
      )}
      {listing.data?.claims.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("continuity.knowledgeEmpty")}
        </p>
      )}
      {listing.data?.claims.map((claim) => (
        <ClaimReview key={`${claim.id}-${claim.revision}`} claim={claim} />
      ))}
      {listing.data?.hasMore && (
        <p className="text-xs text-muted-foreground">
          {t("continuity.knowledgeMore")}
        </p>
      )}
    </section>
  );
}
function ClaimReview({
  claim,
}: {
  claim: z.infer<typeof knowledgeClaimSchema>;
}) {
  const t = useT();
  const [status, setStatus] = useState(claim.status);
  const [notes, setNotes] = useState(claim.reviewNotes);
  const review = useActionMutation("review-knowledge");
  return (
    <article className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="break-words text-sm font-medium">
          {claim.personName} {t(`continuity.knowledge_${claim.relationship}`)}{" "}
          {claim.targetName}
        </h3>
        <span className="rounded bg-secondary px-2 py-1 text-xs">
          {t(`continuity.knowledge_${claim.status}`)}
        </span>
      </div>
      <blockquote className="whitespace-pre-wrap break-words border-l-2 pl-4 text-sm leading-7">
        {claim.quote}
      </blockquote>
      <Link className="inline-block text-xs underline" to={claim.urlPath}>
        {t("continuity.documentsViewSource")}
      </Link>
      <details>
        <summary className="cursor-pointer text-sm">
          {t("continuity.knowledgeReview")}
        </summary>
        <div className="mt-4 space-y-3">
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as typeof status)}
            disabled={review.isPending}
          >
            <SelectTrigger aria-label={t("continuity.knowledgeReviewStatus")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["inferred", "confirmed", "rejected"].map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`continuity.knowledge_${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={notes}
            maxLength={2000}
            disabled={review.isPending}
            aria-label={t("continuity.knowledgeReviewNote")}
            placeholder={t("continuity.knowledgeReviewNote")}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button
            disabled={
              review.isPending ||
              !notes.trim() ||
              (status === claim.status && notes === claim.reviewNotes)
            }
            onClick={() =>
              review.mutate(
                {
                  workspaceId: claim.workspaceId,
                  id: claim.id,
                  revision: claim.revision,
                  status,
                  notes,
                },
                {
                  onSuccess: () =>
                    toast.success(t("continuity.knowledgeReviewed")),
                },
              )
            }
          >
            {t(
              review.isPending
                ? "continuity.verificationSaving"
                : "continuity.knowledgeSaveReview",
            )}
          </Button>
          {review.isError && (
            <p role="alert" className="text-sm text-destructive">
              {actionErrorMessage(review.error) ??
                t("continuity.knowledgeSaveFailed")}
            </p>
          )}
        </div>
      </details>
      {claim.reviewNotes && (
        <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
          {claim.reviewNotes}
        </p>
      )}
    </article>
  );
}
