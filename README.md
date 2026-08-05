# MUSE PRINTS storefront

A Netlify-ready art print storefront with WhatsApp ordering and an invite-only owner dashboard powered by Decap CMS.

## Publish on Netlify

1. Import this GitHub repository into Netlify. No build command is required; the publish directory is `.`.
2. Enable **Netlify Identity** and set registration to **Invite only**.
3. Enable **Git Gateway** under Identity services.
4. Invite the store owner's email address.
5. Open `https://YOUR-SITE.netlify.app/admin/` and accept the invite to manage artwork, uploads, visibility, print sizes, prices, currency, and WhatsApp number.

Every dashboard save commits the updated catalogue to GitHub and triggers a new Netlify deploy.

## Local preview

Serve the folder with any static web server. The storefront reads `data/store.json` at runtime. To test CMS editing locally, run a static server and Decap's local backend proxy.
