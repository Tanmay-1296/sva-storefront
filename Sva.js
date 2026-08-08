=== FILE: next.config.js ===
module.exports = {
  reactStrictMode: true,
}

=== FILE: postcss.config.js ===
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  }
}

=== FILE: tailwind.config.js ===
module.exports = {
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        svs: {
          darknav: "#131921",
          cta_yellow: "#FFD814",
          cta_orange: "#FFA41C",
          neutral_bg: "#F3F3F3"
        }
      },
      boxShadow: {
        'card': '0 2px 8px rgba(0,0,0,0.06)'
      }
    }
  },
  plugins: []
}

=== FILE: prisma/seed.js ===
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.upsert({
    where: { slug: 'svs-smart-key-chain' },
    update: {},
    create: {
      slug: 'svs-smart-key-chain',
      title: 'SVS Smart Key Chain - Instant App-Free Keychain Finder with 2000Hz High-Decibel Chime',
      price: 29.99,
      listPrice: 39.99,
      rating: 4.8,
      reviews: 342,
      inStock: true,
      bullets: [
        'App-Free Instant Control (Operates on local 192.168.4.1 Wi-Fi portal).',
        'Piercing 2000Hz Audio Chime cuts through cushions and bags.',
        '100% Standalone & Private — No subscription fees or cloud tracking.'
      ],
      images: [
        '/images/svs-1.jpg',
        '/images/svs-2.jpg',
        '/images/svs-3.jpg'
      ],
      video: '/video/svs-demo.mp4'
    }
  });

  await prisma.review.createMany({
    data: [
      {
        productId: product.id,
        rating: 5,
        title: 'Amazing — cuts through everything!',
        body: 'I found my keys in seconds, chime is super loud.',
        images: ['/reviews/img1.jpg']
      },
      {
        productId: product.id,
        rating: 4,
        title: 'Great product, battery life ok',
        body: 'Very private and reliable.',
        images: []
      }
    ],
    skipDuplicates: true
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
