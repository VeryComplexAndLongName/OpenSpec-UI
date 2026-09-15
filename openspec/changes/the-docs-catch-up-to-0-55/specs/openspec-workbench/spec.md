## ADDED Requirements

### Requirement: An article's pictures of the product are the documentation's captured pictures

An article in `docs/articles/` SHALL show the product only through
pictures under the documentation images directory. Those pictures are
produced by a named end-to-end capture, so the article's pictures are held
to the same check as the documentation's.

A picture in an article that is not of the product, such as a cover
illustration, MAY live beside the article. It SHALL NOT show a screen of
the product.

#### Scenario: An article shows a feature

- **WHEN** an article in `docs/articles/` includes a picture of a screen of
  the product
- **THEN** the picture's path is under `docs/images/`, and a capture writes
  that file

#### Scenario: An article's cover

- **WHEN** an article carries a cover illustration
- **THEN** the cover sits beside the article, and shows no screen of the
  product
