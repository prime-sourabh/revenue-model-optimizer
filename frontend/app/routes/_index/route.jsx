import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import { login } from "../../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className="flex items-center justify-center h-full w-full text-center p-4">
      <div className="grid gap-8">
        <h1 className="text-4xl font-bold text-gray-900 m-0 p-0">
          A short heading about [your app]
        </h1>
        <p className="text-xl text-gray-600 m-0 p-0 pb-8">
          A tagline about [your app] that describes your value proposition.
        </p>
        {showForm && (
          <Form className="flex items-center justify-start mx-auto gap-4" method="post" action="/auth/login">
            <label className="grid gap-1 max-w-xs text-left text-base">
              <span>Shop domain</span>
              <input className="p-2 border border-gray-300 rounded" type="text" name="shop" />
              <span className="text-sm text-gray-500">e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors" type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className="list-none p-0 pt-12 m-0 flex gap-8 md:flex-row flex-col">
          <li className="max-w-xs text-left md:pb-0 pb-4">
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li className="max-w-xs text-left md:pb-0 pb-4">
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
          <li className="max-w-xs text-left md:pb-0 pb-4">
            <strong>Product feature</strong>. Some detail about your feature and
            its benefit to your customer.
          </li>
        </ul>
      </div>
    </div>
  );
}
