# LinkedIn post: what LLMs say about themselves

## Post

I asked a coding model to compare itself to Anthropic and OpenAI. Honestly.

The answer it gave was exactly what you'd expect from a model that's read the same marketing pages as every other model. It named its strengths, listed its competitors' strengths, and ended with a diplomatic conclusion that satisfies nobody.

I don't blame the model. I blame the training data.

Every LLM is trained on the same corpus — public websites, forum discussions, marketing pages. When you ask a model to compare itself, it doesn't run a diagnostic. It doesn't measure its own benchmark scores. It retrieves the most commonly written-about distinctions and presents them back, carefully balanced, carefully diplomatic.

The answer it gave is the answer the internet already gave.

Two separate questions:
- What a model *says* about itself = its training data and prompt-following ability
- What a model *does* = the only honest measurement

The gap between these two is where the real story lives.

Full article: https://openspec-ui.dev/articles/what-llms-say-about-themselves/

## First comment

The code, the issues and the extension: https://github.com/VeryComplexAndLongName/OpenSpec-UI
(The product is OpenSpec Workbench. The repository and packages are still called OpenSpec-UI.)

---

## Not for posting

Everything below the line stays out of the post and the comment.

### When, and what to attach

Publish on 2026-10-22: a few days after the site page (2026-10-18), not the same day.
Attach: `docs/articles/linkedin/2026-10-18-what-llms-say-about-themselves/cover.jpg`.
Put the repository link in the first comment, not in the post.

### Where each claim comes from

- The experiment (asking a model to compare itself): the author's own prompt and response.
- That models are trained on shared public data: widely documented nature of LLM training corpora.
- The article itself: `docs/articles/site/2026-10-18-what-llms-say-about-themselves.md`.
