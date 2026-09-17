// Subject lock + style block, and the "A Life Well-Loved" narrative arc
// — a gentle, chronological life-journey story (not a day-in-the-life
// structure), ending at the Rainbow Bridge.
//
// AGING ARC: when a customer provides a second (younger) photo, early
// puppy/young-life moments use it as the reference instead of the
// primary photo. Each story entry's `referencePhoto` field is either
// "primary" or "young" — falls back to "primary" for every entry if no
// second photo was provided.

export const SUBJECT_LOCK = "the dog from the reference photo — preserve the exact coat color and markings, ear shape and set, muzzle shape, eye color, body proportions, and tail. Same dog on every page. Do not change the breed, markings, or coloring.";

export const STYLE_BLOCK = "soft watercolor children's-book-style illustration, gentle wet-on-wet washes, muted warm pastel palette with cream paper background, loose soft edges, delicate hand-painted texture, tender and gentle mood, storybook composition, no text, no words, no lettering, no watermark";

export function buildPrompt(scene) {
  return `${scene}\n\n${SUBJECT_LOCK}\n\n${STYLE_BLOCK}`;
}

export const IMAGES = [
  { id: "IMG-00", referencePhoto: "primary", scene: "A gentle portrait of the dog sitting peacefully, surrounded by a wreath of soft wildflowers and leaves, large open space above for the title, warm and tender, front-cover style composition." },
  { id: "IMG-01", referencePhoto: "young", scene: "A pair of loving hands gently cupping a puppy's face at an open front door, welcoming them home for the first time, warm afternoon light." },
  { id: "IMG-02", referencePhoto: "young", scene: "A young puppy exploring a leafy garden path for the first time, curious and wide-eyed, dappled sunlight through the leaves." },
  { id: "IMG-03", referencePhoto: "young", scene: "The dog as a young pup proudly carrying a favorite toy, tail wagging, soft indoor light." },
  { id: "IMG-04", referencePhoto: "young", scene: "The dog running joyfully through a field of wildflowers, ears flying back, full of youthful energy." },
  { id: "IMG-05", referencePhoto: "primary", scene: "The dog splashing happily through a shallow pond, fully soaked and thrilled, water droplets catching the light." },
  { id: "IMG-06", referencePhoto: "primary", scene: "The dog walking a golden sunset path, warm evening light, a peaceful and content mood, slightly slower and more thoughtful pace." },
  { id: "IMG-07", referencePhoto: "primary", scene: "The dog resting on a couch beside a person's gentle hand petting them, steady and warm companionship, soft lamplight." },
  { id: "IMG-08", referencePhoto: "primary", scene: "An older version of the dog sleeping peacefully by a fireplace, a soft blanket nearby, a little grayer around the muzzle, warm firelight." },
  { id: "IMG-09", referencePhoto: "primary", scene: "The dog resting peacefully under a large shade tree in a quiet meadow, eyes gently closed, utterly at peace, soft afternoon light." },
  { id: "IMG-10", referencePhoto: "primary", scene: "The dog resting on a quilt in a warm sunbeam on the floor, completely at ease, a favorite peaceful spot." },
  { id: "IMG-11", referencePhoto: "primary", scene: "The dog asleep in a warm golden sunbeam, deeply peaceful, soft and gentle, dreamlike quality." },
  { id: "IMG-12", referencePhoto: "primary", scene: "The dog resting in a heart-shaped patch of warm sunlight on the floor, tender and full of love, gentle and quiet." },
  { id: "IMG-13", referencePhoto: "primary", scene: "The dog joyfully greeted at an open front door by a loving outstretched hand, warm homecoming light, full of gentle joy." },
  { id: "IMG-14", referencePhoto: "primary", scene: "A simple, empty leash and collar hanging quietly by a front door, soft afternoon light through a window, tender and still." },
  { id: "IMG-15", referencePhoto: "primary", scene: "The dog running joyfully and freely beneath a soft gentle rainbow arching across a peaceful sky, full of light and freedom, uplifting and warm." },
  { id: "IMG-16", referencePhoto: "primary", scene: "A small, simple, sleepy vignette of the dog curled up peacefully asleep with a content, gentle expression, minimal composition on plain cream watercolor paper, lots of empty space." },
];

export const STORY = [
  { img: "IMG-01", lines: ["The day [DOG_NAME] came home,", "everything changed for the better.", "Two small paws, one enormous heart,", "already [PRONOUN_POS] to keep."] },
  { img: "IMG-02", lines: ["The whole world was new then \u2014", "every leaf, every path, every smell", "a small discovery.", "[DOG_NAME] met it all with a wagging tail."] },
  { img: "IMG-03", lines: ["There was always a favorite toy,", "carried proudly from room to room,", "as if to say: \u201Clook what I found,\u201D", "\u201Cisn't it wonderful?\u201D"] },
  { img: "IMG-04", lines: ["Ears flying, feet flying,", "[DOG_NAME] ran like the whole field", "belonged to [PRONOUN].", "For a little while, it did."] },
  { img: "IMG-05", lines: ["Some days were just for splashing \u2014", "soaked, thrilled, utterly unbothered", "by how much of a mess", "a very good dog could make."] },
  { img: "IMG-06", lines: ["The years moved gently on,", "and evenings turned a little more golden.", "[DOG_NAME] walked a little slower now,", "but never any less happy."] },
  { img: "IMG-07", lines: ["Some things never changed \u2014", "a favorite spot beside the people [PRONOUN] loved,", "steady, warm,", "exactly where [PRONOUN] belonged."] },
  { img: "IMG-08", lines: ["A little grayer, a little slower,", "[DOG_NAME] found new comfort", "in warm firelight and soft blankets,", "content simply to rest nearby."] },
  { img: "IMG-09", lines: ["And then, gently \u2014", "the way a long, good day quietly ends \u2014", "[DOG_NAME] found rest.", "Loved every single moment along the way."] },
  { img: "IMG-10", lines: ["That favorite sunny spot on the floor", "still remembers [PRONOUN_POS] shape,", "the quiet, peaceful afternoons", "spent right there, completely content."] },
  { img: "IMG-11", lines: ["Somewhere warm and golden now,", "[DOG_NAME] is sleeping just as peacefully", "as [PRONOUN] always did \u2014", "safe, and deeply loved."] },
  { img: "IMG-12", lines: ["This much love doesn't fade.", "It just changes shape \u2014", "from a wagging tail at the door", "to a warmth that always stays."] },
  { img: "IMG-13", lines: ["We like to imagine it this way:", "a door opening,", "and [DOG_NAME] there to greet us,", "just as joyfully as always."] },
  { img: "IMG-14", lines: ["The leash still hangs by the door.", "We haven't moved it.", "Some things aren't meant to be put away \u2014", "just gently, quietly kept."] },
  { img: "IMG-15", lines: ["And somewhere beneath a gentle rainbow,", "[DOG_NAME] runs free again \u2014", "ears back, full of joy,", "waiting, patiently, for us."] },
];

export function fillText(lines, callName, pronoun) {
  var pronounPos = pronoun === "she" ? "her" : "his";
  return lines.map(function (l) {
    return l
      .replace(/\[DOG_NAME\]/g, callName)
      .replace(/\[PRONOUN_POS\]/g, pronounPos)
      .replace(/\[PRONOUN\]/g, pronoun);
  });
}
