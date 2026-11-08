import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Sparkles, Copy, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../common/Toast';

interface BannerSlide {
  id: string;
  image: string;
  theme: 'dark' | 'light';
  subtitle: string;
  titlePart1: string;
  titleHighlight: string;
  description: string;
  ctaText: string;
  categoryLink?: string;
}

const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 'electronics',
    image: '/banner/Electronics.png',
    theme: 'dark',
    subtitle: 'Curated Multi-Department Electronics',
    titlePart1: 'Exceptional Quality.',
    titleHighlight: 'Effortless Elegance.',
    description: 'Precision acoustics, minimalist desktop workstations, 5G flagship mobile technology and smart accessories curated for the discerning eye.',
    ctaText: 'Explore Electronics Catalogue',
    categoryLink: 'Electronics',
  },
  {
    id: 'fashion',
    image: '/banner/Fashion.png',
    theme: 'light',
    subtitle: 'Artisanal Tailoring & Timeless Wardrobe',
    titlePart1: 'Find Your Everyday Style.',
    titleHighlight: 'Bespoke Comfort.',
    description: 'Tailored Oxford weaves, organic heavyweight cotton, breathable linen silhouettes and handcrafted eyewear designed for effortless living.',
    ctaText: 'Shop Fashion Department',
    categoryLink: 'Fashion',
  },
  {
    id: 'home-kitchen',
    image: '/banner/Home-Kitchen.png',
    theme: 'dark',
    subtitle: 'Sanctuary Living & Culinary Craft',
    titlePart1: 'Make Your Space Feel Like Home.',
    titleHighlight: 'Timeless Warmth.',
    description: 'Pre-seasoned cast iron skillets, borosilicate drinkware, handcrafted ceramic dining and precision cutlery built to last generations.',
    ctaText: 'Explore Home & Kitchen',
    categoryLink: 'Home & Kitchen',
  },
  {
    id: 'grocery',
    image: '/banner/Grocery.png',
    theme: 'light',
    subtitle: 'Farm Fresh & Artisanal Pantry',
    titlePart1: 'Fresh Groceries Daily.',
    titleHighlight: 'Delivered to Your Door.',
    description: 'Single-origin Arabica roasts, cold-pressed virgin oils, raw mountain honey and organic whole spices sourced with verified integrity.',
    ctaText: 'Discover Pantry Staples',
    categoryLink: 'Grocery',
  },
  {
    id: 'beauty',
    image: '/banner/Beauty.png',
    theme: 'dark',
    subtitle: 'Botanical Formulations & Daily Wellness',
    titlePart1: 'Your Everyday Beauty Essentials.',
    titleHighlight: 'Radiant Vitality.',
    description: 'Antioxidant active serums, cold-pressed Moroccan argan extracts, restorative haircare and sonic dental care for everyday vitality.',
    ctaText: 'Shop Beauty & Care',
    categoryLink: 'Beauty & Personal Care',
  },
  {
    id: 'books',
    image: '/banner/Books.png',
    theme: 'dark',
    subtitle: 'Literary Classics & Enduring Wisdom',
    titlePart1: 'Stories That Inspire.',
    titleHighlight: 'Curated Thought.',
    description: 'Masterworks of literature, architectural monographs, philosophy folios and collector volume bindings curated for thoughtful minds.',
    ctaText: 'Explore Book Folios',
    categoryLink: 'Books',
  },
  {
    id: 'fitness',
    image: '/banner/Fitness.png',
    theme: 'dark',
    subtitle: 'High-Performance Movement & Wellness',
    titlePart1: 'Elevate Your Active Life.',
    titleHighlight: 'Peak Discipline.',
    description: 'Cast iron kettlebells, non-slip cork alignment mats, high-velocity jump ropes and performance hydration essentials for your fitness rituals.',
    ctaText: 'Discover Fitness Gear',
    categoryLink: 'Fitness & Sports',
  },
  {
    id: 'toys',
    image: '/banner/Toys.png',
    theme: 'light',
    subtitle: 'Imagination & Mindful Play',
    titlePart1: 'Inspire Joy & Wonder.',
    titleHighlight: 'Creative Horizons.',
    description: 'Sustainably harvested wooden puzzles, educational robotics, magnetic building blocks and heirloom collectibles designed to ignite growing minds.',
    ctaText: 'Explore Toys & Play',
    categoryLink: 'Toys & Accessories',
  },
];

interface HeroBannerProps {
  onShopNow: () => void;
  onApplyCoupon: (code: string) => void;
  onSelectCategory?: (category: string) => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  onShopNow,
  onApplyCoupon,
  onSelectCategory,
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { showToast } = useToast();

  const currentSlide = BANNER_SLIDES[currentSlideIndex];
  const isDark = currentSlide.theme === 'dark';

  const coupons = [
    { code: 'WELCOME10', label: '10% OFF First Order' },
    { code: 'SAVE50', label: 'Flat ₹50 OFF over ₹499' },
    { code: 'FREESHIP', label: 'Free Delivery over ₹300' },
  ];

  // Auto-advance banner every 6 seconds when not hovered
  useEffect(() => {
    if (isHovered) return;
    timerRef.current = window.setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
    }, 6000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHovered]);

  const handleNextSlide = () => {
    setCurrentSlideIndex((prev) => (prev + 1) % BANNER_SLIDES.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlideIndex((prev) => (prev - 1 + BANNER_SLIDES.length) % BANNER_SLIDES.length);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    onApplyCoupon(code);
    showToast(`Coupon ${code} applied to your cart!`, 'success');
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const handleCtaClick = () => {
    if (currentSlide.categoryLink && onSelectCategory) {
      onSelectCategory(currentSlide.categoryLink);
    } else {
      onShopNow();
    }
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="group relative overflow-hidden rounded-3xl my-6 shadow-luxury-md min-h-[460px] sm:min-h-[500px] lg:min-h-[540px] flex items-center transition-all duration-300"
    >
      {/* 1. Full-Cover Background Image with Right-Side Visual Alignment */}
      <img
        key={currentSlide.image}
        src={currentSlide.image}
        alt={currentSlide.subtitle}
        className="absolute inset-0 w-full h-full object-cover object-right sm:object-[80%_center] lg:object-right transition-opacity duration-700 ease-out"
        loading="eager"
      />

      {/* 2. Directional Gradient Scrim: Pure transparent fade to preserve image composition */}
      <div
        className={`absolute inset-0 pointer-events-none transition-all duration-700 ${
          isDark
            ? 'bg-gradient-to-r from-black/80 via-black/40 sm:via-black/25 to-transparent'
            : 'bg-gradient-to-r from-white/90 via-white/55 sm:via-white/30 to-transparent'
        }`}
      />

      {/* 3. Left-Side Text Content Container (Zero solid/brown box, pure transparent background) */}
      <div className="relative z-10 max-w-xl lg:max-w-2xl px-6 sm:px-12 lg:px-16 py-10 sm:py-14 flex flex-col justify-center items-start text-left space-y-5 sm:space-y-6">
        
        {/* Curated Subtitle Pill */}
        <div
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider backdrop-blur-sm transition-colors ${
            isDark
              ? 'bg-white/15 text-white border border-white/25 drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
              : 'bg-black/10 text-espresso border border-black/15'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${isDark ? 'text-bronze-light' : 'text-bronze'}`} />
          <span>{currentSlide.subtitle}</span>
        </div>

        {/* Editorial Headline */}
        <h1
          className={`font-serif text-3xl sm:text-4xl lg:text-5xl font-normal tracking-tight leading-[1.14] transition-colors ${
            isDark
              ? 'text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)]'
              : 'text-espresso drop-shadow-[0_1px_3px_rgba(255,255,255,0.8)]'
          }`}
        >
          {currentSlide.titlePart1}{' '}
          <span
            className={`italic font-normal block sm:inline ${
              isDark ? 'text-bronze-light drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]' : 'text-bronze'
            }`}
          >
            {currentSlide.titleHighlight}
          </span>
        </h1>

        {/* Narrative Description */}
        <p
          className={`text-sm sm:text-base leading-relaxed font-light max-w-lg transition-colors ${
            isDark
              ? 'text-slate-100 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]'
              : 'text-espresso/90 drop-shadow-[0_1px_2px_rgba(255,255,255,0.7)]'
          }`}
        >
          {currentSlide.description}
        </p>

        {/* Interactive Vouchers Strip */}
        <div className="pt-1 w-full">
          <span
            className={`text-[11px] font-semibold uppercase tracking-widest block mb-2 transition-colors ${
              isDark
                ? 'text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]'
                : 'text-espresso/80 drop-shadow-[0_1px_2px_rgba(255,255,255,0.6)]'
            }`}
          >
            Exclusive Promotional Privileges:
          </span>
          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {coupons.map((c) => (
              <button
                key={c.code}
                onClick={() => handleCopy(c.code)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium backdrop-blur-md shadow-sm transition-all cursor-pointer active:scale-98 ${
                  isDark
                    ? 'bg-black/40 hover:bg-black/60 border-white/20 text-white'
                    : 'bg-white/75 hover:bg-white/95 border-black/15 text-espresso'
                }`}
                title={`Click to copy and apply ${c.code}`}
              >
                <span
                  className={`font-mono font-bold ${
                    isDark ? 'text-bronze-light' : 'text-bronze'
                  }`}
                >
                  {c.code}
                </span>
                <span className="opacity-40 hidden sm:inline">•</span>
                <span className={isDark ? 'text-slate-200' : 'text-espresso/80'}>
                  {c.label}
                </span>
                {copiedCode === c.code ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                ) : (
                  <Copy
                    className={`w-3.5 h-3.5 transition-colors ml-0.5 opacity-60 group-hover:opacity-100 ${
                      isDark ? 'group-hover:text-bronze-light' : 'group-hover:text-bronze'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div className="pt-2">
          <button
            onClick={handleCtaClick}
            className={`px-6 py-3 rounded-xl font-semibold text-xs sm:text-sm shadow-luxury-md flex items-center gap-2 transition-all cursor-pointer transform hover:-translate-y-0.5 ${
              isDark
                ? 'bg-white hover:bg-bronze text-espresso hover:text-white'
                : 'bg-espresso hover:bg-bronze text-white'
            }`}
          >
            <span>{currentSlide.ctaText}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4. Slide Navigation Controls (Discreet & Architectural) */}
      <div className="absolute right-4 sm:right-8 bottom-6 z-20 flex items-center gap-3">
        {/* Previous Button */}
        <button
          onClick={handlePrevSlide}
          className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer opacity-70 hover:opacity-100 ${
            isDark
              ? 'bg-white/15 hover:bg-white/30 text-white border-white/20'
              : 'bg-black/10 hover:bg-black/20 text-espresso border-black/15'
          }`}
          aria-label="Previous Banner"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Slide Indicators */}
        <div className="flex items-center gap-1.5">
          {BANNER_SLIDES.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => setCurrentSlideIndex(index)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                currentSlideIndex === index
                  ? isDark
                    ? 'w-6 bg-white'
                    : 'w-6 bg-espresso'
                  : isDark
                  ? 'w-1.5 bg-white/40 hover:bg-white/70'
                  : 'w-1.5 bg-espresso/30 hover:bg-espresso/60'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNextSlide}
          className={`w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer opacity-70 hover:opacity-100 ${
            isDark
              ? 'bg-white/15 hover:bg-white/30 text-white border-white/20'
              : 'bg-black/10 hover:bg-black/20 text-espresso border-black/15'
          }`}
          aria-label="Next Banner"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
