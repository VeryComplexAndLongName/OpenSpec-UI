## Approach

Use private Git refs under refs/openspec-ui/reviewed for durable local markers. Save only a validated displayed SHA equal to HEAD. Reuse the patch reader for a direct tree comparison. Both hosts keep the report state and offer an explicit switch to the full PR base comparison.
