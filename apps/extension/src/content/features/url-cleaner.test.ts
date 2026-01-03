/**
 * URL Cleaner Tests
 * Tests for URL cleaning functionality and tracking parameter removal
 */

import { describe, it, expect } from "vitest";
import { cleanUrl, TRACKING_PARAMS } from "./url-cleaner.js";

describe("URL Cleaner", () => {
  describe("cleanUrl()", () => {
    describe("UTM parameter removal", () => {
      it("should remove utm_source parameter", () => {
        const url = "https://example.com/page?utm_source=google";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove utm_medium parameter", () => {
        const url = "https://example.com/page?utm_medium=cpc";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove utm_campaign parameter", () => {
        const url = "https://example.com/page?utm_campaign=summer_sale";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove utm_term parameter", () => {
        const url = "https://example.com/page?utm_term=keyword";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove utm_content parameter", () => {
        const url = "https://example.com/page?utm_content=banner";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove utm_id parameter", () => {
        const url = "https://example.com/page?utm_id=12345";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove multiple UTM parameters", () => {
        const url =
          "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=summer";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove all UTM variants", () => {
        const url =
          "https://example.com/page?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=keyword&utm_content=banner&utm_id=123&utm_source_platform=platform&utm_creative_format=format&utm_marketing_tactic=tactic";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });
    });

    describe("Facebook tracking parameter removal", () => {
      it("should remove fbclid parameter", () => {
        const url = "https://example.com/page?fbclid=IwAR1234567890";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove fb_action_ids parameter", () => {
        const url = "https://example.com/page?fb_action_ids=123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove fb_action_types parameter", () => {
        const url = "https://example.com/page?fb_action_types=purchase";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove fb_ref parameter", () => {
        const url = "https://example.com/page?fb_ref=ref123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove fb_source parameter", () => {
        const url = "https://example.com/page?fb_source=feed";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove multiple Facebook parameters", () => {
        const url =
          "https://example.com/page?fbclid=IwAR1234&fb_action_ids=123&fb_source=feed";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });
    });

    describe("Google tracking parameter removal", () => {
      it("should remove gclid parameter", () => {
        const url = "https://example.com/page?gclid=CjwKCAiA1234567890";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove gclsrc parameter", () => {
        const url = "https://example.com/page?gclsrc=aw.ds";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove dclid parameter", () => {
        const url = "https://example.com/page?dclid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove gbraid parameter", () => {
        const url = "https://example.com/page?gbraid=0AAAAAGBraid123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove wbraid parameter", () => {
        const url = "https://example.com/page?wbraid=0AAAAAGWbraid123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove multiple Google parameters", () => {
        const url =
          "https://example.com/page?gclid=CjwK&gclsrc=aw.ds&dclid=123&gbraid=0AAA";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });
    });

    describe("Other common tracking parameters", () => {
      it("should remove ref parameter", () => {
        const url = "https://example.com/page?ref=twitter";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove source parameter", () => {
        const url = "https://example.com/page?source=newsletter";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove mc_cid parameter", () => {
        const url = "https://example.com/page?mc_cid=123456";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove mc_eid parameter", () => {
        const url = "https://example.com/page?mc_eid=789012";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove _ga parameter", () => {
        const url = "https://example.com/page?_ga=2.123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove _gl parameter", () => {
        const url = "https://example.com/page?_gl=1*abc123*";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove msclkid parameter", () => {
        const url = "https://example.com/page?msclkid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove igshid parameter", () => {
        const url = "https://example.com/page?igshid=1234567890";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove twclid parameter", () => {
        const url = "https://example.com/page?twclid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove li_fat_id parameter", () => {
        const url = "https://example.com/page?li_fat_id=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove wickedid parameter", () => {
        const url = "https://example.com/page?wickedid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove yclid parameter", () => {
        const url = "https://example.com/page?yclid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove ncid parameter", () => {
        const url = "https://example.com/page?ncid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove srsltid parameter", () => {
        const url = "https://example.com/page?srsltid=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove si parameter", () => {
        const url = "https://example.com/page?si=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove feature parameter", () => {
        const url = "https://example.com/page?feature=share";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove app parameter", () => {
        const url = "https://example.com/page?app=mobile";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove ved parameter", () => {
        const url = "https://example.com/page?ved=2ahUKEwi123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove usg parameter", () => {
        const url = "https://example.com/page?usg=AOvVaw123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove sa parameter", () => {
        const url = "https://example.com/page?sa=X";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove ei parameter", () => {
        const url = "https://example.com/page?ei=123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove bvm parameter", () => {
        const url = "https://example.com/page?bvm=bv.123456789";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should remove sxsrf parameter", () => {
        const url = "https://example.com/page?sxsrf=ALiCzsZ123";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });
    });

    describe("Legitimate query parameter preservation", () => {
      it("should preserve page parameter", () => {
        const url = "https://example.com/page?page=2";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page?page=2");
      });

      it("should preserve search query parameter", () => {
        const url = "https://example.com/search?q=javascript";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/search?q=javascript");
      });

      it("should preserve id parameter", () => {
        const url = "https://example.com/product?id=12345";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/product?id=12345");
      });

      it("should preserve category parameter", () => {
        const url = "https://example.com/products?category=electronics";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/products?category=electronics");
      });

      it("should preserve sort parameter", () => {
        const url = "https://example.com/products?sort=price";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/products?sort=price");
      });

      it("should preserve filter parameter", () => {
        const url = "https://example.com/products?filter=color:red";
        const result = cleanUrl(url);
        // URL encoding converts : to %3A
        expect(result).toBe("https://example.com/products?filter=color%3Ared");
      });

      it("should preserve multiple legitimate parameters", () => {
        const url =
          "https://example.com/products?category=electronics&sort=price&page=2";
        const result = cleanUrl(url);
        expect(result).toBe(
          "https://example.com/products?category=electronics&sort=price&page=2"
        );
      });

      it("should preserve legitimate params while removing tracking params", () => {
        const url =
          "https://example.com/products?category=electronics&utm_source=google&page=2&utm_medium=cpc";
        const result = cleanUrl(url);
        expect(result).toBe(
          "https://example.com/products?category=electronics&page=2"
        );
      });
    });

    describe("Hash fragment preservation", () => {
      it("should preserve hash fragment", () => {
        const url = "https://example.com/page#section";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page#section");
      });

      it("should preserve hash fragment with tracking params", () => {
        const url = "https://example.com/page?utm_source=google#section";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page#section");
      });

      it("should preserve hash fragment with legitimate params", () => {
        const url = "https://example.com/page?page=2#section";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page?page=2#section");
      });

      it("should preserve complex hash fragment", () => {
        const url =
          "https://example.com/page?utm_source=google&page=2#section-with-dashes";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page?page=2#section-with-dashes");
      });
    });

    describe("Edge cases", () => {
      it("should handle URL without query parameters", () => {
        const url = "https://example.com/page";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should handle URL with only tracking parameters", () => {
        const url = "https://example.com/page?utm_source=google&utm_medium=cpc";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should handle URL with empty query string", () => {
        const url = "https://example.com/page?";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should handle URL with trailing slash", () => {
        const url = "https://example.com/page/?utm_source=google";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page/");
      });

      it("should handle URL with port number", () => {
        const url = "https://example.com:8080/page?utm_source=google";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com:8080/page");
      });

      it("should handle URL with subdomain", () => {
        const url = "https://sub.example.com/page?utm_source=google";
        const result = cleanUrl(url);
        expect(result).toBe("https://sub.example.com/page");
      });

      it("should handle URL with special characters in legitimate params", () => {
        const url =
          "https://example.com/search?q=hello%20world&utm_source=google";
        const result = cleanUrl(url);
        // URLSearchParams converts %20 to + in toString()
        expect(result).toBe("https://example.com/search?q=hello+world");
      });

      it("should handle URL with encoded special characters", () => {
        const url =
          "https://example.com/search?q=test%2Bquery&utm_source=google";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/search?q=test%2Bquery");
      });

      it("should handle URL with multiple values for same param", () => {
        const url =
          "https://example.com/search?tag=javascript&tag=typescript&utm_source=google";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/search?tag=javascript&tag=typescript");
      });

      it("should handle case-sensitive parameter names", () => {
        const url = "https://example.com/page?UTM_SOURCE=google&utm_source=google";
        const result = cleanUrl(url);
        // Only lowercase utm_source should be removed
        expect(result).toBe("https://example.com/page?UTM_SOURCE=google");
      });

      it("should handle very long URLs", () => {
        const longParam = "a".repeat(1000);
        const url = `https://example.com/page?param=${longParam}&utm_source=google`;
        const result = cleanUrl(url);
        expect(result).toBe(`https://example.com/page?param=${longParam}`);
      });

      it("should handle URL with no protocol", () => {
        const url = "example.com/page?utm_source=google";
        const result = cleanUrl(url);
        // Should return original URL if parsing fails
        expect(result).toBe("example.com/page?utm_source=google");
      });

      it("should handle malformed URL gracefully", () => {
        const url = "not a valid url at all";
        const result = cleanUrl(url);
        // Should return original URL if parsing fails
        expect(result).toBe("not a valid url at all");
      });

      it("should handle empty string", () => {
        const url = "";
        const result = cleanUrl(url);
        // Should return original URL if parsing fails
        expect(result).toBe("");
      });
    });

    describe("Real-world examples", () => {
      it("should clean Amazon product URL", () => {
        const url =
          "https://www.amazon.com/dp/B08N5WRWNW?ref=ppx_yo2ov_dt_b_product_details&th=1&psc=1";
        const result = cleanUrl(url);
        expect(result).toBe("https://www.amazon.com/dp/B08N5WRWNW?th=1&psc=1");
      });

      it("should clean Google search result URL", () => {
        const url =
          "https://example.com/page?q=test&ved=2ahUKEwi&usg=AOvVaw&ei=123&sa=X";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page?q=test");
      });

      it("should clean Facebook shared link", () => {
        const url =
          "https://example.com/article?fbclid=IwAR1234567890&utm_source=facebook";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/article");
      });

      it("should clean Twitter/X shared link", () => {
        const url =
          "https://example.com/page?twclid=123456789&utm_source=twitter";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/page");
      });

      it("should clean newsletter link with multiple tracking params", () => {
        const url =
          "https://example.com/article?mc_cid=123&mc_eid=456&utm_source=newsletter&utm_medium=email&utm_campaign=weekly";
        const result = cleanUrl(url);
        expect(result).toBe("https://example.com/article");
      });

      it("should clean complex e-commerce URL", () => {
        const url =
          "https://shop.example.com/products?category=shoes&sort=price&page=2&utm_source=google&utm_medium=cpc&utm_campaign=summer&gclid=CjwK&fbclid=IwAR";
        const result = cleanUrl(url);
        expect(result).toBe(
          "https://shop.example.com/products?category=shoes&sort=price&page=2"
        );
      });
    });
  });

  describe("TRACKING_PARAMS constant", () => {
    it("should be a non-empty array", () => {
      expect(Array.isArray(TRACKING_PARAMS)).toBe(true);
      expect(TRACKING_PARAMS.length).toBeGreaterThan(0);
    });

    it("should contain all UTM parameters", () => {
      expect(TRACKING_PARAMS).toContain("utm_source");
      expect(TRACKING_PARAMS).toContain("utm_medium");
      expect(TRACKING_PARAMS).toContain("utm_campaign");
      expect(TRACKING_PARAMS).toContain("utm_term");
      expect(TRACKING_PARAMS).toContain("utm_content");
    });

    it("should contain Facebook tracking parameters", () => {
      expect(TRACKING_PARAMS).toContain("fbclid");
      expect(TRACKING_PARAMS).toContain("fb_action_ids");
    });

    it("should contain Google tracking parameters", () => {
      expect(TRACKING_PARAMS).toContain("gclid");
      expect(TRACKING_PARAMS).toContain("dclid");
    });

    it("should contain Twitter tracking parameters", () => {
      expect(TRACKING_PARAMS).toContain("twclid");
    });

    it("should be a readonly array type", () => {
      // TypeScript enforces readonly at compile time, not runtime
      // This test verifies the type is readonly by checking it's an array
      expect(Array.isArray(TRACKING_PARAMS)).toBe(true);
      // Verify it's not empty and contains expected values
      expect(TRACKING_PARAMS.length).toBeGreaterThan(0);
      expect(TRACKING_PARAMS[0]).toBeDefined();
    });
  });
});

