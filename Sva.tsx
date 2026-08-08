=== FILE: lib/prisma.ts ===
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export default prisma;

=== FILE: pages/_app.tsx ===
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { CartProvider } from '../components/CartContext'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <CartProvider>
      <Component {...pageProps} />
    </CartProvider>
  )
}

=== FILE: pages/index.tsx ===
import Link from 'next/link'
import Navbar from '../components/Navbar'

export default function Home() {
  return (
    <div>
      <Navbar />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-bold">Welcome to SVS Storefront</h1>
        <p className="mt-4">Demo product:</p>
        <Link href="/product/svs-smart-key-chain"><a className="text-blue-600">SVS Smart Key Chain — View Product</a></Link>
      </main>
    </div>
  )
}

=== FILE: pages/product/[slug].tsx ===
import { GetServerSideProps } from 'next'
import prisma from '../../lib/prisma'
import Navbar from '../../components/Navbar'
import ImageGallery from '../../components/ImageGallery'
import BuyBox from '../../components/BuyBox'
import Reviews from '../../components/Reviews'

export default function ProductPage({ product, reviews }) {
  if (!product) return <div>Product not found</div>

  return (
    <div>
      <Navbar />
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1">
          <ImageGallery images={product.images} video={product.video} />
        </section>

        <section className="lg:col-span-1 bg-white p-6 shadow-card">
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <div className="flex items-center space-x-3 mt-2">
            <div className="text-yellow-400">★★★★★</div>
            <div className="text-sm text-gray-600">{product.rating} ({product.reviews} customer reviews)</div>
          </div>

          <div className="mt-4">
            <div className="text-3xl font-bold">${product.price.toFixed(2)}</div>
            <div className="line-through text-sm text-gray-500">${product.listPrice.toFixed(2)}</div>
            <div className="text-green-600 mt-2">In Stock</div>
          </div>

          <ul className="list-disc mt-4 ml-5 text-sm space-y-2">
            {product.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </section>

        <aside className="lg:col-span-1">
          <BuyBox product={product} />
          <div className="mt-4 bg-white p-4 shadow-card text-sm">
            <div>Ships from: SVS Direct</div>
            <div>Sold by: SVS Official Store</div>
            <div className="mt-2 text-xs text-gray-500">Secure transaction</div>
          </div>
        </aside>
      </main>

      <div className="max-w-7xl mx-auto p-6">
        <Reviews reviews={reviews} rating={product.rating} />
      </div>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const slug = ctx.params.slug as string
  const product = await prisma.product.findUnique({ where: { slug } })
  const reviews = await prisma.review.findMany({ where: { productId: product?.id || 0 }, orderBy: { createdAt: 'desc' } })
  return { props: { product: product ? JSON.parse(JSON.stringify(product)) : null, reviews: JSON.parse(JSON.stringify(reviews)) } }
}

=== FILE: pages/api/checkout/session.ts ===
import type { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' })

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { items } = req.body
  const line_items = items.map(it => ({
    price_data: {
      currency: 'usd',
      product_data: { name: it.title },
      unit_amount: Math.round(it.price * 100)
    },
    quantity: it.quantity
  }))

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items,
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/checkout/cancel`
  })
  res.json({ url: session.url })
}

=== FILE: pages/api/products/[slug].ts ===
import prisma from '../../../lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { slug } = req.query
  const product = await prisma.product.findUnique({ where: { slug: String(slug) } })
  if (!product) return res.status(404).json({ error: 'Not found' })
  res.json(product)
}

=== FILE: pages/api/webhooks/stripe.ts ===
import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import prisma from '../../../lib/prisma'

export const config = { api: { bodyParser: false } }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2022-11-15' })

async function buffer(readable: any) {
  const chunks = []
  for await (const chunk of readable) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const sig = req.headers['stripe-signature'] as string
  const buf = await buffer(req)
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err) {
    console.error('Webhook signature verification failed.', err)
    return res.status(400).send(`Webhook Error: ${err}`)
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    try {
      await prisma.order.create({
        data: {
          stripeSessionId: session.id,
          total: Number((session.amount_total ?? 0) / 100),
          status: 'paid',
          customerEmail: session.customer_details?.email ?? ''
        }
      })
    } catch (dbErr) {
      console.error('Failed to persist order', dbErr)
    }
  }

  res.json({ received: true })
}

=== FILE: components/Navbar.tsx ===
import Link from 'next/link'
import { useCart } from './CartContext'
import { useState } from 'react'

export default function Navbar() {
  const { items, openCart } = useCart()
  const count = items.reduce((s, it) => s + it.quantity, 0)
  const [location, setLocation] = useState('Select your address')

  return (
    <header>
      <div className="bg-svs-darknav text-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/">
            <a className="text-2xl font-bold">SVS</a>
          </Link>
          <div className="hidden sm:flex items-center space-x-2">
            <svg className="w-5 h-5" />
            <div>
              <div className="text-xs">Deliver to</div>
              <div className="text-sm">{location}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 mx-6">
          <div className="flex bg-white rounded overflow-hidden">
            <select className="p-2">
              <option>All Departments</option>
              <option>Keychains</option>
              <option>Bundles</option>
              <option>Accessories</option>
            </select>
            <input className="flex-1 p-3" placeholder="Search SVS Smart Key Chain, battery pack..." />
            <button className="bg-[#FFD814] px-4">Search</button>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="hidden sm:block">Account &amp; Lists</div>
          <div className="hidden sm:block">Orders</div>
          <button onClick={openCart} className="relative">
            <svg className="w-6 h-6" />
            {count > 0 && (
              <span className="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full px-2 text-xs">{count}</span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white shadow px-4 py-2">
        <nav className="flex space-x-6 text-sm">
          <a className="hover:underline">Today's Deals</a>
          <a className="hover:underline">Customer Service</a>
          <a className="hover:underline">Registry</a>
          <a className="hover:underline">Gift Cards</a>
          <a className="hover:underline">Sell</a>
        </nav>
      </div>
    </header>
  )
}

=== FILE: components/CartContext.tsx ===
import React, { createContext, useContext, useState } from 'react'

type CartItem = { productId: number; title: string; price: number; quantity: number; image?: string }

const CartContext = createContext<any>(null)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setOpen] = useState(false)

  const addItem = (item: CartItem) => {
    setItems(prev => {
      const idx = prev.findIndex(p => p.productId === item.productId)
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx].quantity = Math.min(10, copy[idx].quantity + item.quantity)
        return copy
      }
      return [...prev, item]
    })
  }

  const updateQty = (productId: number, qty: number) =>
    setItems(prev => prev.map(p => p.productId === productId ? { ...p, quantity: qty } : p))

  const remove = (productId: number) => setItems(prev => prev.filter(p => p.productId !== productId))

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0)
  const taxes = +(subtotal * 0.07).toFixed(2)
  const shipping = subtotal > 50 ? 0 : 4.99

  return (
    <CartContext.Provider value={{ items, addItem, updateQty, remove, subtotal, taxes, shipping, isOpen, setOpen, openCart: () => setOpen(true), closeCart: () => setOpen(false) }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)

=== FILE: components/ImageGallery.tsx ===
import { useState } from 'react'

export default function ImageGallery({ images = [], video }) {
  const [active, setActive] = useState(0)
  return (
    <div className="bg-white p-4 shadow-card">
      <div className="w-full h-96 flex items-center justify-center border">
        {active === -1 && video ? (
          <video src={video} controls className="h-full" />
        ) : (
          <img src={images[active]} alt="product" className="h-full object-contain" />
        )}
      </div>

      <div className="flex mt-3 space-x-2">
        {images.map((src, i) => (
          <button key={i} onClick={() => setActive(i)} className={`w-20 h-20 border ${active===i ? 'ring-2 ring-svs-cta_yellow' : ''}`}>
            <img src={src} className="w-full h-full object-cover" />
          </button>
        ))}
        {video && (
          <button onClick={() => setActive(-1)} className="w-20 h-20 border">
            <div className="w-full h-full flex items-center justify-center">▶</div>
          </button>
        )}
      </div>
    </div>
  )
}

=== FILE: components/BuyBox.tsx ===
import { useState } from 'react'
import { useCart } from './CartContext'
import axios from 'axios'

export default function BuyBox({ product }) {
  const [qty, setQty] = useState(1)
  const { addItem } = useCart()
  const addToCart = () => {
    addItem({ productId: product.id, title: product.title, price: product.price, quantity: qty, image: product.images[0] })
  }

  const buyNow = async () => {
    const { data } = await axios.post('/api/checkout/session', {
      items: [{ productId: product.id, title: product.title, price: product.price, quantity: qty }]
    })
    window.location.href = data.url
  }

  return (
    <div className="bg-white p-6 shadow-card">
      <div className="text-2xl font-bold">${product.price.toFixed(2)}</div>
      <div className="flex items-center mt-3">
        <label className="mr-2">Qty:</label>
        <select value={qty} onChange={e => setQty(Number(e.target.value))} className="border p-2">
          {Array.from({length:10}).map((_,i) => <option key={i} value={i+1}>{i+1}</option>)}
        </select>
      </div>
      <button onClick={addToCart} className="w-full mt-4 py-3 bg-[#FFD814] hover:opacity-90 rounded">Add to Cart</button>
      <button onClick={buyNow} className="w-full mt-2 py-3 bg-[#FFA41C] text-white rounded">Buy Now</button>
    </div>
  )
}

=== FILE: components/Reviews.tsx ===
export default function Reviews({ reviews = [], rating = 4.8 }) {
  const counts = [5,4,3,2,1].map(star => reviews.filter(r=>r.rating===star).length)
  const total = reviews.length || 1
  return (
    <section className="bg-white p-6 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-3xl font-bold">{rating} <span className="text-yellow-400">★★★★★</span></div>
          <div className="text-sm text-gray-600">{reviews.length} customer reviews</div>
        </div>
        <div>
          <button className="px-4 py-2 border rounded">Write a review</button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          { [5,4,3,2,1].map((star, idx) => {
            const c = counts[idx]
            const pct = Math.round((c/total)*100)
            return (
              <div key={star} className="flex items-center space-x-3 my-2">
                <div className="w-8 text-sm">{star}★</div>
                <div className="flex-1 bg-gray-200 h-3 rounded overflow-hidden">
                  <div style={{width: `${pct}%`}} className="bg-yellow-400 h-full"></div>
                </div>
                <div className="w-10 text-xs text-gray-600">{c}</div>
              </div>
            )
          })}
        </div>

        <div className="md:col-span-2">
          <div className="grid grid-cols-2 gap-4">
            {reviews.map(r => (
              <div key={r.id} className="border p-3 rounded">
                <div className="text-sm font-semibold">{r.title}</div>
                <div className="text-xs text-gray-500">{r.rating} ★</div>
                <div className="text-sm mt-2">{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
  }
