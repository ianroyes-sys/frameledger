import SwiftUI

// This immutable synthetic fixture is covered by the native scenario test.
private let demoAvailable = try! Snapshot.demo.available()

private let ink = Color(red: 0.031, green: 0.035, blue: 0.051)
private let panel = Color(red: 0.075, green: 0.082, blue: 0.11)
private let accent = Color(red: 0.65, green: 0.54, blue: 0.98)
private let secondaryInk = Color(red: 0.64, green: 0.65, blue: 0.72)

@main struct FrameLedgerApp: App {
  var body: some Scene { WindowGroup { StudioApp().preferredColorScheme(.dark).tint(accent) } }
}
struct StudioProject: Identifiable {
  let id, name, kind, date: String
  let value, received, costs: Int64
  let symbol: String
  static let examples = [
    StudioProject(
      id: "wedding", name: "Johnson Wedding", kind: "WEDDING / 01", date: "October 12",
      value: 320_000, received: 160_000, costs: 57_000, symbol: "camera.aperture"),
    StudioProject(
      id: "studio", name: "Studio North", kind: "CONTENT / 02", date: "October 18", value: 240_000,
      received: 0, costs: 40_000, symbol: "viewfinder"),
    StudioProject(
      id: "motion", name: "After Hours", kind: "FILM / 03", date: "October 25", value: 180_000,
      received: 0, costs: 25_000, symbol: "film"),
  ]
}
struct StudioApp: View {
  @State private var simulator = false
  @State private var breakdown = false
  var body: some View {
    TabView {
      NavigationStack { overview }.tabItem { Label("Studio", systemImage: "square.grid.2x2") }
      NavigationStack { projectList }.tabItem { Label("Projects", systemImage: "rectangle.stack") }
      NavigationStack { invoices }.tabItem { Label("Invoices", systemImage: "doc.text") }
      NavigationStack { settings }.tabItem { Label("You", systemImage: "person.crop.circle") }
    }.sheet(isPresented: $simulator) { PurchaseSimulator() }
      .sheet(isPresented: $breakdown) { BreakdownView() }
  }
  private var overview: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 25) {
        HStack {
          VStack(alignment: .leading, spacing: 7) {
            Text("FRAMELEDGER").font(.system(size: 12, weight: .bold, design: .monospaced))
              .tracking(3)
            Text("Your next chapter.").font(.system(size: 30, weight: .medium))
          }
          Spacer()
          Image(systemName: "camera.aperture").font(.title).foregroundStyle(accent)
        }
        demoLabel
        Button {
          breakdown = true
        } label: {
          VStack(alignment: .leading, spacing: 22) {
            HStack {
              Label("Safe to spend", systemImage: "sparkle")
              Spacer()
              Image(systemName: "arrow.up.right")
            }.font(.subheadline)
            Text(Money.format(demoAvailable)).font(
              .system(size: 59, weight: .light, design: .rounded)
            ).minimumScaleFactor(0.6).lineLimit(1).monospacedDigit()
            Text("Room to create.").font(.title3)
            Divider().overlay(.white.opacity(0.2))
            HStack {
              Text("Recorded balance").font(.footnote)
              Spacer()
              Text(Money.format(160_000)).font(.subheadline.weight(.semibold))
            }
          }.padding(26).foregroundStyle(.white)
            .background {
              RoundedRectangle(cornerRadius: 28).fill(
                LinearGradient(
                  colors: [
                    Color(red: 0.31, green: 0.20, blue: 0.52),
                    Color(red: 0.14, green: 0.13, blue: 0.25), panel,
                  ], startPoint: .topLeading, endPoint: .bottomTrailing)
              ).overlay(alignment: .topTrailing) {
                Image(systemName: "square.on.square").font(.system(size: 135, weight: .ultraLight))
                  .rotationEffect(.degrees(-20)).foregroundStyle(.white.opacity(0.08)).offset(
                    x: 20, y: 15)
              }.clipShape(RoundedRectangle(cornerRadius: 28)).overlay(
                RoundedRectangle(cornerRadius: 28).stroke(.white.opacity(0.14))
              ).shadow(color: accent.opacity(0.13), radius: 25, y: 12)
            }
        }.buttonStyle(.plain).accessibilityHint("Show how available money is calculated")
        HStack(spacing: 12) {
          Button {
            simulator = true
          } label: {
            action("Try a purchase", "slider.horizontal.3")
          }
          Button {
            breakdown = true
          } label: {
            action("Your reserves", "square.stack.3d.up")
          }
        }.buttonStyle(.plain)
        HStack(spacing: 12) {
          metric("To collect", "$5,800", "Expected, not settled")
          metric("Tax reserve", "$400", "Virtual allocation")
        }
        HStack {
          Text("On the studio floor").font(.title2.weight(.medium))
          Spacer()
        }
        ForEach(StudioProject.examples) { project in
          NavigationLink {
            ProjectDetail(project: project)
          } label: {
            ProjectRow(project: project)
          }.buttonStyle(.plain)
        }
        Text(
          "Available after recorded reserves and commitments. Synthetic USD records only; no funds or bank accounts are connected."
        ).font(.footnote).foregroundStyle(secondaryInk)
      }.padding(22)
    }.background(ink).toolbar(.hidden, for: .navigationBar)
  }
  private var projectList: some View {
    ScrollView {
      VStack(spacing: 16) {
        demoLabel
        ForEach(StudioProject.examples) { project in
          NavigationLink {
            ProjectDetail(project: project)
          } label: {
            ProjectRow(project: project)
          }.buttonStyle(.plain)
        }
      }.padding(22)
    }.background(ink).navigationTitle("Project wallets")
  }
  private var invoices: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        demoLabel
        Text("Good work.\nGet paid for it.").font(.largeTitle.weight(.medium))
        invoice("Johnson · Booking retainer", "$1,600", "Paid", true)
        invoice("Johnson · Final balance", "$1,600", "Due October 19", false)
        invoice("Studio North · Content", "$2,400", "Due October 20", false)
        invoice("After Hours · Film", "$1,800", "Draft", false)
        Text(
          "Invoice sending and payment collection are unavailable in this native demo. Your web workspace handles these when the provider is configured."
        ).font(.footnote).foregroundStyle(secondaryInk)
      }.padding(22)
    }.background(ink).navigationTitle("Invoices")
  }
  private var settings: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 24) {
        Image(systemName: "person.crop.circle.fill").font(.system(size: 64)).foregroundStyle(accent)
        Text("Your creative studio").font(.title)
        demoLabel
        Text("Native preview").font(.title2)
        Text(
          "Explore the synthetic wedding scenario. Nothing you do here moves money or changes your web workspace."
        ).foregroundStyle(secondaryInk)
        Divider()
        Label("Live connection is not enabled", systemImage: "lock.shield").font(.headline)
        Text(
          "Secure sign-in, approved financial services, and account lifecycle flows must be completed before live access. This build contains no provider credentials."
        ).foregroundStyle(secondaryInk)
        Text("Royz Media Group LLC").font(.footnote)
        Text("FrameLedger is a financial workspace. This demo does not offer banking services.")
          .font(.footnote).foregroundStyle(secondaryInk)
      }.padding(24)
    }.background(ink).navigationTitle("Your workspace")
  }
  private func action(_ title: String, _ symbol: String) -> some View {
    VStack(alignment: .leading, spacing: 17) {
      Image(systemName: symbol).font(.title2).foregroundStyle(accent)
      Text(title).font(.subheadline.weight(.medium))
    }.frame(maxWidth: .infinity, alignment: .leading).padding(19).background(
      panel, in: RoundedRectangle(cornerRadius: 21)
    ).overlay(RoundedRectangle(cornerRadius: 21).stroke(.white.opacity(0.07)))
  }
  private func metric(_ title: String, _ amount: String, _ note: String) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(title).font(.footnote).foregroundStyle(secondaryInk)
      Text(amount).font(.title2).monospacedDigit()
      Text(note).font(.caption2).foregroundStyle(secondaryInk)
    }.frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10)
  }
  private func invoice(_ title: String, _ amount: String, _ status: String, _ paid: Bool)
    -> some View
  {
    VStack(alignment: .leading, spacing: 12) {
      Text(title).font(.headline)
      HStack {
        Text(amount).font(.title2).monospacedDigit()
        Spacer()
        Text(status).font(.caption).foregroundStyle(paid ? .mint : accent)
      }
    }.padding(20).background(panel, in: RoundedRectangle(cornerRadius: 20))
  }
}
private var demoLabel: some View {
  Label("DEMO · SYNTHETIC DATA", systemImage: "circle.dotted").font(
    .system(size: 10, weight: .semibold, design: .monospaced)
  ).tracking(1.3).foregroundStyle(accent)
}
struct ProjectRow: View {
  let project: StudioProject
  var body: some View {
    HStack(spacing: 15) {
      Image(systemName: project.symbol).font(.title2).foregroundStyle(accent).frame(
        width: 58, height: 66
      ).background(
        LinearGradient(
          colors: [accent.opacity(0.28), .indigo.opacity(0.08)], startPoint: .topLeading,
          endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 15))
      VStack(alignment: .leading, spacing: 7) {
        Text(project.kind).font(.system(size: 9, weight: .medium, design: .monospaced)).tracking(
          1.5
        ).foregroundStyle(secondaryInk)
        Text(project.name).font(.headline)
        Text(project.date).font(.caption).foregroundStyle(secondaryInk)
      }
      Spacer()
      Image(systemName: "arrow.up.right").foregroundStyle(secondaryInk)
    }.padding(15).background(panel, in: RoundedRectangle(cornerRadius: 22))
  }
}
struct ProjectDetail: View {
  let project: StudioProject
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 25) {
        demoLabel
        Image(systemName: project.symbol).font(.system(size: 65, weight: .ultraLight))
          .foregroundStyle(accent).frame(maxWidth: .infinity).padding(35).background(
            LinearGradient(
              colors: [accent.opacity(0.30), panel], startPoint: .topLeading,
              endPoint: .bottomTrailing), in: RoundedRectangle(cornerRadius: 26))
        Text(project.name).font(.largeTitle.weight(.medium))
        numberRow("Project value", project.value)
        numberRow("Received", project.received)
        numberRow("Still to collect", project.value - project.received)
        Divider()
        numberRow("Committed direct costs", project.costs)
        numberRow("Estimated project profit", project.value - project.costs)
        Text(
          "Estimate before owner labor, tax and overhead, assuming the full project value is collected. Commitments are planned costs; no payments occur in this demo."
        ).font(.footnote).foregroundStyle(secondaryInk)
        if project.id == "wedding" {
          Text("Cost plan").font(.title2)
          numberRow("Second shooter", 45_000)
          numberRow("Travel estimate", 12_000)
        }
      }.padding(24)
    }.background(ink).navigationTitle("Project wallet").navigationBarTitleDisplayMode(.inline)
  }
}
private func numberRow(_ label: String, _ value: Int64) -> some View {
  HStack(alignment: .firstTextBaseline) {
    Text(label).foregroundStyle(secondaryInk)
    Spacer(minLength: 15)
    Text(Money.format(value)).monospacedDigit().fontWeight(.medium)
  }
}
struct BreakdownView: View {
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 23) {
          demoLabel
          Text("Every dollar,\nwith a purpose.").font(.largeTitle.weight(.medium))
          numberRow("Recorded balance", 160_000)
          numberRow("Tax reserve", -40_000)
          numberRow("Gear reserve", -16_000)
          numberRow("Second shooter", -45_000)
          numberRow("Travel commitment", -12_000)
          Divider()
          numberRow("Safe to spend", demoAvailable)
          Text(
            "Reserves are virtual bookkeeping envelopes, not separate bank accounts. This total only accounts for obligations recorded in the synthetic scenario."
          ).font(.footnote).foregroundStyle(secondaryInk)
        }.padding(25)
      }.background(ink).toolbar {
        ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
      }
    }
  }
}
struct PurchaseSimulator: View {
  @Environment(\.dismiss) private var dismiss
  @AppStorage("demo.purchaseAmount") private var amount = "2400"
  private var cents: Int64? { try? Money.cents(amount) }
  private var afterward: Int64? {
    guard let cents else { return nil }
    return try? Snapshot.demo.afterPurchase(cents)
  }
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          demoLabel
          Text("Make room for\nyour next idea.").font(.largeTitle.weight(.medium))
          Text("Purchase impact").foregroundStyle(secondaryInk)
          HStack {
            Text("$").font(.largeTitle)
            TextField("Amount in USD", text: $amount).keyboardType(.decimalPad).font(
              .system(size: 44, weight: .light, design: .rounded)
            ).accessibilityLabel("Purchase amount in US dollars")
          }.padding(20).background(panel, in: RoundedRectangle(cornerRadius: 20))
          numberRow("Safe to spend now", demoAvailable)
          if let afterward {
            numberRow("After this purchase", afterward)
            Text(
              afterward < 0
                ? "This purchase exceeds currently available cash. It would draw on money reserved for recorded obligations."
                : "This purchase leaves the recorded reserves and commitments covered."
            ).foregroundStyle(afterward < 0 ? .orange : .mint)
            numberRow("Tax reserve remains", 40_000)
            numberRow("Gear reserve remains", 16_000)
            Text(
              "Expected invoices are excluded because they have not settled. No money is moved; this is a cash-flow scenario, not financial advice."
            ).font(.footnote).foregroundStyle(secondaryInk)
          } else {
            Text("Enter a positive USD amount with up to two decimal places.").foregroundStyle(
              .orange)
          }
        }.padding(25)
      }.background(ink).toolbar {
        ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
      }
    }
  }
}
