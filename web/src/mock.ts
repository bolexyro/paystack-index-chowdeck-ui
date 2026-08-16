export const mockBrowse = {
  view: "recommendations",
  title: "A few good options",
  address: "Lekki Phase 1, Lagos",
  openCount: 12,
  restaurants: [
    {
      vendorId: "demo-1",
      name: "Native Foods",
      imageUrl:
        "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
      location: "Admiralty Way",
      distanceKm: 1.2,
      rating: 4.8,
      ratingCount: 306,
      etaMinutes: 31,
      deliveryFeeNaira: 1200,
      isOpen: true
    },
    {
      vendorId: "demo-2",
      name: "Jollof & Co.",
      imageUrl:
        "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=900&q=80",
      location: "Fola Osibo",
      distanceKm: 2.5,
      rating: 4.6,
      ratingCount: 184,
      etaMinutes: 42,
      deliveryFeeNaira: 1650,
      isOpen: true
    },
    {
      vendorId: "demo-3",
      name: "The Breakfast Club",
      imageUrl:
        "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
      location: "Ikoyi",
      distanceKm: 4.1,
      rating: 4.7,
      ratingCount: 98,
      etaMinutes: 54,
      deliveryFeeNaira: 2400,
      isOpen: false,
      nextOpening: "Tomorrow at 8:00 AM"
    }
  ]
};

export const mockMenu = {
  view: "menu",
  menu: {
    vendorId: "demo-1",
    vendorName: "Native Foods",
    isOpen: true,
    categories: [
      {
        menuId: "popular",
        name: "Most loved",
        items: [
          {
            itemId: "jollof-chicken",
            name: "Smoky party jollof",
            description:
              "Firewood-style jollof, grilled chicken, sweet plantain and pepper sauce.",
            imageUrl:
              "https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?auto=format&fit=crop&w=600&q=80",
            priceNaira: 5800,
            available: true,
            requiresOptions: false,
            optionGroupIds: []
          },
          {
            itemId: "ofada",
            name: "Ofada special",
            description:
              "Local rice, ayamase, assorted meats and a boiled egg.",
            imageUrl:
              "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80",
            priceNaira: 6300,
            available: true,
            requiresOptions: true,
            optionGroupIds: ["protein"]
          }
        ]
      },
      {
        menuId: "sides",
        name: "Sides & drinks",
        items: [
          {
            itemId: "plantain",
            name: "Dodo",
            description: "Golden, caramelised ripe plantain.",
            priceNaira: 1800,
            available: true,
            requiresOptions: false,
            optionGroupIds: []
          }
        ]
      }
    ]
  }
};

export const mockMenuPicks = {
  view: "menu-picks",
  vendorId: mockMenu.menu.vendorId,
  vendorName: mockMenu.menu.vendorName,
  isOpen: mockMenu.menu.isOpen,
  address: "Lekki Phase 1, Lagos",
  title: "Good picks under ₦10,000",
  subtitle: "A short list from Native Foods' menu.",
  items: mockMenu.menu.categories.flatMap((category) => category.items)
};
