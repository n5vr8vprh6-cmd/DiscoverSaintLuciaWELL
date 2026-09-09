/* ==========================================================================
   PUBLIC RATE LOOKUP — GENERATED, DO NOT EDIT BY HAND
   --------------------------------------------------------------------------
   Written by tools/build-rates.js from content/rates.observed.json. To change
   a figure, change the observation (or the authored published tariff) and
   rebuild. Read ONLY by api/_lib/rates.js. Never required by anything that
   builds a prompt — see tools/design-privacy-test.js.

   OBSERVED PUBLIC RATE = what Expedia showed a stranger on `observed`, for two
   adults and seven nights. Not a tariff, not a quote. An empty week is an
   empty week: nothing here is interpolated.
   ======================================================================== */
'use strict';

module.exports = {
  "currency": "USD",
  "basis": "Two adults, seven nights from the check-in date shown, room only unless the property is all-inclusive. Cheapest to most expensive room shown that day.",
  "sampled": {
    "method": "expedia.com property page in a real browser, chkin/chkout set, rm1=a2",
    "weeks": [
      "2026-10-12",
      "2026-11-09",
      "2026-12-14",
      "2026-12-21",
      "2027-01-11",
      "2027-02-08",
      "2027-03-08",
      "2027-04-12",
      "2027-05-10",
      "2027-06-14",
      "2027-07-12",
      "2027-08-09",
      "2027-09-13"
    ],
    "nights": 7,
    "adults": 2,
    "began": "2026-09-09"
  },
  "built": "2026-09-09",
  "properties": {
    "anse-chastanet": {
      "region": "south-west",
      "taxRule": "Applicable VAT often included; 10% service typically added — verify activity tax wording.",
      "basis": "room only; half board and all-inclusive offered as supplements",
      "weeks": [
        {
          "weekOf": "2026-10-12",
          "from": 451,
          "to": 972,
          "roomType": "Standard Room",
          "rooms": 4,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2026-10-12",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-11-09",
          "from": 669,
          "to": 923,
          "roomType": "Superior Room, Ocean View",
          "rooms": 2,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2026-11-09",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-12-14",
          "from": 763,
          "to": 1334,
          "roomType": "Standard Room",
          "rooms": 3,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2026-12-14",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-01-11",
          "from": 894,
          "to": 1354,
          "roomType": "Superior Room, Ocean View",
          "rooms": 4,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-01-11",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-02-08",
          "from": 1169,
          "to": 1354,
          "roomType": "Hillside Deluxe Oceanview",
          "rooms": 2,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-02-08",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-03-08",
          "from": 722,
          "to": 1354,
          "roomType": "Standard Room",
          "rooms": 5,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-03-08",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-04-12",
          "from": 628,
          "to": 1204,
          "roomType": "Standard Room",
          "rooms": 4,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-04-12",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-05-10",
          "from": 538,
          "to": 1083,
          "roomType": "Standard Room",
          "rooms": 3,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-05-10",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-06-14",
          "from": 438,
          "to": 945,
          "roomType": "Standard Room",
          "rooms": 5,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-06-14",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-07-12",
          "from": 438,
          "to": 945,
          "roomType": "Standard Room",
          "rooms": 4,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-07-12",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-08-09",
          "from": 438,
          "to": 945,
          "roomType": "Standard Room",
          "rooms": 5,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Anse-Chastanet-Resort.h854223.Hotel-Information?chkin=2027-08-09",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        }
      ]
    },
    "ladera-resort": {
      "region": "south-west",
      "taxRule": "Confirm tax and service with the property.",
      "basis": "room only; all-inclusive offered as a supplement",
      "weeks": [
        {
          "weekOf": "2026-11-09",
          "from": 983,
          "to": 983,
          "roomType": "Heritage Suite",
          "rooms": 1,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2026-11-09",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-12-14",
          "from": 1255,
          "to": 1403,
          "roomType": "Heritage Suite",
          "rooms": 2,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2026-12-14",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-12-21",
          "from": 947,
          "to": 1516,
          "roomType": "Petit Piton Suite",
          "rooms": 6,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2026-12-21",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-01-11",
          "from": 802,
          "to": 1142,
          "roomType": "Gros Piton Suite",
          "rooms": 2,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2027-01-11",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-02-08",
          "from": 1006,
          "to": 1233,
          "roomType": "Hilltop Dream Suite",
          "rooms": 3,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2027-02-08",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-03-08",
          "from": 765,
          "to": 1245,
          "roomType": "Petit Piton Suite",
          "rooms": 5,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2027-03-08",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-04-12",
          "from": 744,
          "to": 1208,
          "roomType": "Petit Piton Suite",
          "rooms": 6,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2027-04-12",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-05-10",
          "from": 752,
          "to": 1221,
          "roomType": "Petit Piton Suite",
          "rooms": 6,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Soufriere-Hotels-Ladera-Resort.h68868.Hotel-Information?chkin=2027-05-10",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        }
      ]
    },
    "zoetry-marigot-bay": {
      "region": "west",
      "taxRule": "All-inclusive; confirm what the rate excludes.",
      "basis": "all-inclusive",
      "weeks": [
        {
          "weekOf": "2026-10-12",
          "from": 574,
          "to": 2640,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 7,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2026-10-12",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-11-09",
          "from": 634,
          "to": 2954,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 7,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2026-11-09",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-12-14",
          "from": 598,
          "to": 2717,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 6,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2026-12-14",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2026-12-21",
          "from": 887,
          "to": 4079,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 8,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2026-12-21",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-01-11",
          "from": 761,
          "to": 3503,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 9,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2027-01-11",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-02-08",
          "from": 826,
          "to": 3753,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 9,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2027-02-08",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        },
        {
          "weekOf": "2027-03-08",
          "from": 680,
          "to": 3167,
          "roomType": "Junior Suite, 1 King Bed, Garden View (Resort View)",
          "rooms": 9,
          "observed": "2026-09-09",
          "source": "https://www.expedia.com/Marigot-Bay-Hotels-Marigot-Bay-Resort-And-Marina.h1355200.Hotel-Information?chkin=2027-03-08",
          "source_kind": "ota",
          "confidence": "OBSERVED PUBLIC RATE",
          "board": null
        }
      ]
    },
    "thelifeco-st-lucia": {
      "region": "north",
      "taxRule": "Confirm tax and service with the operator.",
      "basis": "programme and accommodation bundled, all-inclusive",
      "weeks": [],
      "published": {
        "from": 600,
        "to": 800,
        "unit": "per night, all-inclusive programme and accommodation",
        "basis": "Standard from $600, Superior from $750, Suite from $800",
        "observed": "2026-08-10",
        "source": "https://www.thelifeco.com/en/centers/thelifeco-st-lucia/",
        "source_kind": "property",
        "confidence": "PUBLISHED TARIFF",
        "note": "Operator's published starting rates; a programme is required."
      }
    },
    "aila-resorts-villas-residences": {
      "region": "north",
      "taxRule": "Confirm tax and service with the operator.",
      "basis": "TheLifeCo programme and accommodation bundled; other phases not open",
      "weeks": [],
      "published": {
        "from": 600,
        "to": 800,
        "unit": "per night, all-inclusive programme and accommodation",
        "basis": "TheLifeCo at A’ILA: Standard from $600, Superior from $750, Suite from $800",
        "observed": "2026-08-10",
        "source": "https://www.ailaresorts.com/",
        "source_kind": "property",
        "confidence": "PUBLISHED TARIFF",
        "note": "Only the operating TheLifeCo centre; A’ILA Cove and Palm are not open."
      }
    },
    "jade-mountain": {
      "weeks": [],
      "region": "south-west",
      "taxRule": "10% service added; reconfirm older brochure figures.",
      "basis": "room only; packages bundle spa"
    },
    "sugar-beach-viceroy": {
      "weeks": [],
      "region": "south-west",
      "taxRule": "VAT and service extra on spa; confirm room tax.",
      "basis": "room only"
    },
    "stonefield-villa-resort": {
      "weeks": [],
      "region": "south-west",
      "taxRule": "Official rates exclude 15% tax.",
      "basis": "room only"
    },
    "rabot-hotel-hotel-chocolat": {
      "weeks": [],
      "region": "south-west",
      "taxRule": "Confirm tax and service with the property.",
      "basis": "room only; half board +$100, full board +$120, all-inclusive +$160 per guest per day (property site, 2026-09-09)"
    },
    "sandals-grande-st-lucian": {
      "weeks": [],
      "region": "north",
      "taxRule": "All-inclusive.",
      "basis": "all-inclusive"
    },
    "cap-maison": {
      "weeks": [],
      "region": "north",
      "taxRule": "Service and VAT at 20% on facility fees; confirm room tax.",
      "basis": "room only; Cap It All inclusive supplement"
    },
    "calabash-cove": {
      "weeks": [],
      "region": "north",
      "taxRule": "Confirm tax and service with the property.",
      "basis": "all-inclusive or room and breakfast, by rate"
    },
    "bodyholiday": {
      "weeks": [],
      "region": "north",
      "taxRule": "All-inclusive with daily treatment.",
      "basis": "all-inclusive"
    },
    "the-landings": {
      "weeks": [],
      "region": "north",
      "taxRule": "Confirm tax and service with the property.",
      "basis": "room only; inclusions vary by rate"
    },
    "stolentime": {
      "weeks": [],
      "region": "north-west",
      "taxRule": "All-inclusive.",
      "basis": "all-inclusive; Expedia still lists the property under its former name, Rendezvous"
    }
  },
  "transfers": [
    {
      "key": "uvf-south-west-sedan",
      "label": "Hewanorra (UVF) to Soufrière, private sedan",
      "from": 120,
      "to": 120,
      "unit": "per couple, each way",
      "duration": "60–75 min",
      "observed": "2026-09-09",
      "source": "https://ansechastanet.com/reserve/booking-info/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "region": "south-west"
    },
    {
      "key": "slu-south-west-sedan",
      "label": "George F. L. Charles (SLU) to Soufrière, private sedan",
      "from": 135,
      "to": 135,
      "unit": "per couple, each way",
      "duration": "75–90 min",
      "observed": "2026-09-09",
      "source": "https://ansechastanet.com/reserve/booking-info/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "region": "south-west"
    },
    {
      "key": "uvf-south-west-luxury",
      "label": "Hewanorra (UVF) to Soufrière, private luxury sedan",
      "from": 205,
      "to": 205,
      "unit": "per couple, each way",
      "duration": "60–75 min",
      "observed": "2026-09-09",
      "source": "https://ansechastanet.com/reserve/booking-info/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "region": "south-west"
    },
    {
      "key": "slu-south-west-luxury",
      "label": "George F. L. Charles (SLU) to Soufrière, private luxury sedan",
      "from": 225,
      "to": 225,
      "unit": "per couple, each way",
      "duration": "75–90 min",
      "observed": "2026-09-09",
      "source": "https://ansechastanet.com/reserve/booking-info/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "region": "south-west"
    },
    {
      "key": "uvf-north",
      "label": "Hewanorra (UVF) to the north (Rodney Bay, Cap Estate)",
      "from": null,
      "to": null,
      "unit": "per vehicle, each way",
      "duration": "75–90 min",
      "observed": null,
      "source": null,
      "source_kind": null,
      "confidence": "QUOTE / CONFIRM",
      "region": "north"
    },
    {
      "key": "uvf-west",
      "label": "Hewanorra (UVF) to Marigot Bay",
      "from": null,
      "to": null,
      "unit": "per vehicle, each way",
      "duration": "60 min",
      "observed": null,
      "source": null,
      "source_kind": null,
      "confidence": "QUOTE / CONFIRM",
      "region": "west"
    },
    {
      "key": "between-regions",
      "label": "Between a south-west and a north property",
      "from": null,
      "to": null,
      "unit": "per vehicle, each way",
      "duration": "90–120 min",
      "observed": null,
      "source": null,
      "source_kind": null,
      "confidence": "QUOTE / CONFIRM",
      "region": null
    }
  ],
  "experiences": [
    {
      "key": "ladera-piton-hike",
      "label": "Custom Pitons hike (Ladera)",
      "from": 375,
      "to": 375,
      "unit": "per person",
      "duration": "3–4 h",
      "observed": "2026-08-10",
      "source": "https://www.ladera.com/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "high"
    },
    {
      "key": "ladera-private-yoga",
      "label": "Private yoga, 60 min (Ladera)",
      "from": 215,
      "to": 215,
      "unit": "per session",
      "duration": "60 min",
      "observed": "2026-08-10",
      "source": "https://www.ladera.com/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "low"
    },
    {
      "key": "anse-sup-yoga",
      "label": "SUP yoga (Anse Chastanet)",
      "from": 35,
      "to": 140,
      "unit": "per person: $35 group, $100 single private, $140 couple",
      "duration": "60–90 min",
      "observed": "2026-08-10",
      "source": "https://www.ansechastanet.com/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "medium"
    },
    {
      "key": "bodyholiday-padi-scuba-diver",
      "label": "PADI Scuba Diver course (BodyHoliday)",
      "from": 375,
      "to": 375,
      "unit": "per person",
      "duration": "2 days",
      "observed": "2026-08-10",
      "source": "https://www.thebodyholiday.com/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "high"
    },
    {
      "key": "bodyholiday-padi-open-water",
      "label": "PADI Open Water course (BodyHoliday)",
      "from": 550,
      "to": 550,
      "unit": "per person",
      "duration": "3–4 days",
      "observed": "2026-08-10",
      "source": "https://www.thebodyholiday.com/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "high"
    },
    {
      "key": "zoetry-body-bliss",
      "label": "Marigot Body Bliss: massage, detox-tea class, Sulphur Springs mud bath (Zoëtry)",
      "from": 540,
      "to": 540,
      "unit": "for two",
      "duration": "half day",
      "observed": "2026-08-10",
      "source": "https://www.hyattinclusivecollection.com/en/resorts-hotels/zoetry/st-lucia/marigot-bay-st-lucia/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "low"
    },
    {
      "key": "zoetry-body-ritual",
      "label": "Marigot Body Ritual: massage, springs, hot-stone massage, chocolate-making (Zoëtry)",
      "from": 790,
      "to": 790,
      "unit": "for two",
      "duration": "full day",
      "observed": "2026-08-10",
      "source": "https://www.hyattinclusivecollection.com/en/resorts-hotels/zoetry/st-lucia/marigot-bay-st-lucia/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": "low"
    },
    {
      "key": "rabot-half-board",
      "label": "Half board supplement (Rabot)",
      "from": 100,
      "to": 100,
      "unit": "per guest per day",
      "duration": null,
      "observed": "2026-09-09",
      "source": "https://saintlucia.hotelchocolat.com/rabot-hotel/packages-offers/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": null
    },
    {
      "key": "rabot-all-inclusive",
      "label": "All-inclusive supplement (Rabot)",
      "from": 160,
      "to": 160,
      "unit": "per guest per day",
      "duration": null,
      "observed": "2026-09-09",
      "source": "https://saintlucia.hotelchocolat.com/rabot-hotel/packages-offers/",
      "source_kind": "property",
      "confidence": "PUBLISHED TARIFF",
      "intensity": null
    },
    {
      "key": "gros-piton-guided",
      "label": "Gros Piton guided climb (Piton Management Area guides)",
      "from": null,
      "to": null,
      "unit": "per person",
      "duration": "4–6 h",
      "observed": null,
      "source": null,
      "source_kind": null,
      "confidence": "QUOTE / CONFIRM",
      "intensity": "high"
    },
    {
      "key": "sulphur-springs-mud-bath",
      "label": "Sulphur Springs mud bath entry",
      "from": null,
      "to": null,
      "unit": "per person",
      "duration": "1–2 h",
      "observed": null,
      "source": null,
      "source_kind": null,
      "confidence": "QUOTE / CONFIRM",
      "intensity": "low"
    }
  ]
};
