import React from 'react';
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { CATEGORY_BANNERS } from '../../services/api';

const CATEGORY_SHOWCASE_DATA = [
  {
    name: 'Electronics',
    tagline: 'Flagship smartphones, precision noise-cancelling audio, workstations and smart accessories.',
    subcategories: ['Smartphones', 'Laptops', 'Audio & Headphones', 'Tablets', 'Wearables'],
    featuredItem: 'Galaxy S26 Ultra & Pro Audio',
  },
  {
    name: 'Grocery',
    tagline: 'Single-origin Arabica roasts, cold-pressed virgin oils, organic teas & pantry provisions.',
    subcategories: ['Gourmet Coffee', 'Cold-Pressed Oils', 'Organic Staples', 'Artisanal Spices'],
    featuredItem: 'Artisanal Arabica & Organic Honey',
  },
  {
    name: 'Fashion',
    tagline: 'Tailored Oxford shirts, organic heavyweight denim, breathable linens and timeless optics.',
    subcategories: ['Men’s Tailored', 'Women’s Essentials', 'Premium Denim', 'Designer Eyewear'],
    featuredItem: 'Heavyweight Cotton & Oxford Weaves',
  },
  {
    name: 'Home & Kitchen',
    tagline: 'Pre-seasoned cast iron skillets, borosilicate drinkware, chef knives and minimalist decor.',
    subcategories: ['Cast Iron Cookware', 'Chef Knives', 'Borosilicate Glass', 'Porcelain Dining'],
    featuredItem: 'Cast Iron & Borosilicate Glassware',
  },
  {
    name: 'Beauty & Personal Care',
    tagline: 'Pure cold-pressed argan oil, vitamin C serums, mineral sunscreens and sonic dental care.',
    subcategories: ['Active Serums', 'Botanical Oils', 'Hair Wellness', 'Sonic Oral Care'],
    featuredItem: 'Antioxidant Serums & Argan Extracts',
  },
  {
    name: 'Books & Stationery',
    tagline: 'Archival 100gsm notebooks, solid brass writing instruments, design monographs & literature.',
    subcategories: ['Hardcover Journals', 'Brass Pens', 'Artisan Paper', 'Curated Non-Fiction'],
    featuredItem: 'Heavyweight Dot Notebooks & Pens',
  },
  {
    name: 'Sports & Fitness',
    tagline: 'High-density natural rubber yoga mats, precision hex dumbbells and vacuum thermal flasks.',
    subcategories: ['Yoga & Pilates', 'Strength Equipment', 'Hydration Flasks', 'Recovery Gear'],
    featuredItem: 'Non-Slip Alignment Mats & Dumbbells',
  },
  {
    name: 'Toys & Accessories',
    tagline: 'Robotics kits, brushless motor drones, mechanical puzzle cubes and creative model craft.',
    subcategories: ['STEM Robotics', 'Camera Drones', 'Speed Cubes', 'Wooden Engineering'],
    featuredItem: 'Brushless Drones & STEM Mechanics',
  },
];

interface CategoryShowcaseProps {
  onSelectCategory: (category: string) => void;
}

export const CategoryShowcase: React.FC<CategoryShowcaseProps> = ({ onSelectCategory }) => {
  return (
    <section aria-labelledby="curated-departments-heading" className="py-12 space-y-8">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-softBorder dark:border-dark-border pb-5">
        <div>
          <span className="text-xs font-semibold uppercase tracking-widest text-bronze dark:text-bronze-gold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Curated Shopping Departments
          </span>
          <h2
            id="curated-departments-heading"
            className="font-serif text-2xl sm:text-4xl font-normal text-espresso dark:text-porcelain mt-1"
          >
            Explore Verified Department Collections
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-mutedGrey dark:text-dark-muted max-w-md leading-relaxed">
          Select any department to browse its dedicated catalog with subcategories, real-time inventory, and multi-parameter filtering.
        </p>
      </div>

      {/* Large Category Banners: Strictly 2 per row on desktop, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {CATEGORY_SHOWCASE_DATA.map((cat) => {
          const bannerUrl = CATEGORY_BANNERS[cat.name] || '/banner/Electronics.png';

          return (
            <div
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className="group relative h-80 sm:h-96 rounded-3xl overflow-hidden cursor-pointer bg-espresso border border-softBorder dark:border-dark-border shadow-luxury-md hover:shadow-luxury-lg transition-all duration-500 transform hover:-translate-y-1"
            >
              {/* Category Background Image */}
              <img
                src={bannerUrl}
                alt={cat.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-106 opacity-85"
                loading="lazy"
              />

              {/* Architectural Scrim Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#201A14] via-[#201A14]/40 to-transparent" />

              {/* Top Department Badge */}
              <div className="absolute top-4 left-4 z-10">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#201A14]/70 backdrop-blur-md text-white text-[11px] font-semibold tracking-wide border border-white/15">
                  <span className="w-1.5 h-1.5 rounded-full bg-bronze" />
                  {cat.featuredItem}
                </span>
              </div>

              {/* Bottom Information Card */}
              <div className="absolute inset-x-4 bottom-4 z-10 p-5 rounded-2xl bg-[#201A14]/85 backdrop-blur-md border border-white/10 text-white flex flex-col justify-between transition-transform duration-300 group-hover:bg-[#201A14]/92">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-xl sm:text-2xl font-semibold text-porcelain tracking-tight">
                      {cat.name}
                    </h3>
                    <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center group-hover:bg-bronze transition-colors">
                      <ArrowUpRight className="w-4 h-4 text-white" />
                    </div>
                  </div>

                  <p className="text-xs text-stone-200 mt-2 line-clamp-2 leading-relaxed font-light">
                    {cat.tagline}
                  </p>
                </div>

                {/* Subcategories Pills Preview & CTA */}
                <div className="mt-4 pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-1.5">
                    {cat.subcategories.slice(0, 3).map((sub, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] text-stone-200 font-medium"
                      >
                        {sub}
                      </span>
                    ))}
                    {cat.subcategories.length > 3 && (
                      <span className="text-[10px] text-stone-400 self-center">
                        +{cat.subcategories.length - 3} more
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-bronze-light group-hover:text-white transition-colors">
                    <span>Enter Department</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
