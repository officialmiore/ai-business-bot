// modules/pod.js
import fetch from "node-fetch";

export async function createPODProduct({ title, prompt }){
  // This creates a safe payload instructing the user how to create the product.
  // For full automation you'd need to generate an image, host it somewhere and POST to Printful /store/products.
  if(!title || !prompt) return { error: "title and prompt required" };
  const designPrompt = `Design for product: ${title} — creative prompt: ${prompt}`;
  return {
    ok: true,
    message: "POD product payload created. Use generated design prompt with your image generator, upload image and call Printful API to create product.",
    payload: { title, designPrompt }
  };
}
