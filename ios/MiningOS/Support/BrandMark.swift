import SwiftUI

/// The FW gem mark, drawn as a faceted stone in the brand teal. Vector, so it
/// stays crisp at any size and needs no image asset. Used on sign-in / site-picker.
struct BrandMark: View {
    var size: CGFloat = 76

    var body: some View {
        ZStack {
            GemShape().fill(
                LinearGradient(
                    colors: [Brand.teal, Brand.tealDeep],
                    startPoint: .top, endPoint: .bottom
                )
            )
            GemFacets().stroke(Color.white.opacity(0.55), lineWidth: max(1, size * 0.028))
            GemShape().stroke(Brand.tealDeep.opacity(0.9), lineWidth: max(1, size * 0.02))
        }
        .frame(width: size, height: size)
        .shadow(color: Brand.teal.opacity(0.35), radius: size * 0.14, y: size * 0.06)
        .accessibilityHidden(true)
    }
}

/// Front-view faceted gem outline: table (top) → shoulders → point.
private struct GemShape: Shape {
    func path(in rect: CGRect) -> Path {
        let p = GemGeometry(rect)
        var path = Path()
        path.move(to: p.t1)
        path.addLine(to: p.t2)
        path.addLine(to: p.gr)
        path.addLine(to: p.b)
        path.addLine(to: p.gl)
        path.closeSubpath()
        return path
    }
}

/// Internal facet lines: the girdle band plus two crown-to-point diagonals.
private struct GemFacets: Shape {
    func path(in rect: CGRect) -> Path {
        let p = GemGeometry(rect)
        var path = Path()
        path.move(to: p.gl); path.addLine(to: p.gr)      // girdle
        path.move(to: p.t1); path.addLine(to: p.b)       // left diagonal
        path.move(to: p.t2); path.addLine(to: p.b)       // right diagonal
        return path
    }
}

/// Shared fractional geometry so outline and facets always align.
private struct GemGeometry {
    let t1, t2, gr, b, gl: CGPoint
    init(_ r: CGRect) {
        func pt(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: r.minX + x * r.width, y: r.minY + y * r.height)
        }
        t1 = pt(0.34, 0.30); t2 = pt(0.66, 0.30)
        gr = pt(0.90, 0.47); gl = pt(0.10, 0.47)
        b  = pt(0.50, 0.90)
    }
}

/// The full wordmark lockup used on the auth screens.
struct BrandLockup: View {
    var markSize: CGFloat = 76
    var body: some View {
        VStack(spacing: 16) {
            BrandMark(size: markSize)
            VStack(spacing: 3) {
                Text("FW Mining OS").font(.geist(26, .semibold))
                Text("Mining operations, in your pocket")
                    .font(.geist(14)).foregroundStyle(.secondary)
            }
        }
    }
}
