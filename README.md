# Uncleluwa storefront

A Netlify-ready art print storefront with WhatsApp ordering and an invite-only owner dashboard. The dashboard uses the supported Netlify Identity package for authentication and Netlify Blobs for catalogue data and artwork uploads.

## Publish on Netlify

1. Import this GitHub repository into Netlify. The included `netlify.toml` supplies the build, publish and functions settings.
2. Enable **Netlify Identity** and set registration to **Invite only**.
3. Invite the store owner's email address.
4. Open `https://YOUR-SITE.netlify.app/admin/` and accept the invite to manage artwork, uploads, visibility, artwork-specific print sizes and prices, currency, and WhatsApp number.

Dashboard saves are applied immediately through site-scoped Netlify Blobs, so content updates do not require a new deploy.

## Local preview

Run `npm install`, then `npm run build`. The generated static site is written to `dist`. Identity and Blobs require a linked Netlify environment for end-to-end testing.
