import SwiftUI

/// Branded sign-in: the gem lockup over a titled email/password form.
struct SignInView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.horizontalSizeClass) private var hSize

    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false
    @State private var error: String?
    @State private var busy = false

    private var canSubmit: Bool { !email.isEmpty && !password.isEmpty && !busy }

    var body: some View {
        GeometryReader { geo in
        ScrollView {
            VStack(spacing: 28) {
                BrandLockup()
                    .padding(.top, hSize == .regular ? 0 : 48)

                VStack(spacing: 16) {
                    BrandField(label: "Email", icon: "envelope") {
                        TextField("you@company.com", text: $email)
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                    }
                    BrandField(label: "Password", icon: "lock") {
                        HStack(spacing: 8) {
                            Group {
                                if showPassword {
                                    TextField("Your password", text: $password)
                                } else {
                                    SecureField("Your password", text: $password)
                                }
                            }
                            .textContentType(.password)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            Button {
                                showPassword.toggle()
                            } label: {
                                Image(systemName: showPassword ? "eye.slash" : "eye")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }

                if let error {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.geist(13)).foregroundStyle(Brand.expenseRed)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button(action: signIn) {
                    Group {
                        if busy { ProgressView().tint(.white) }
                        else { Text("Sign in").font(.geist(16, .semibold)) }
                    }
                    .frame(maxWidth: .infinity).frame(height: 52)
                }
                .background(Brand.teal.opacity(canSubmit ? 1 : 0.5),
                            in: RoundedRectangle(cornerRadius: 14))
                .foregroundStyle(.white)
                .disabled(!canSubmit)

                Text("Use the account from your web dashboard.")
                    .font(.geist(12)).foregroundStyle(.tertiary)
            }
            .padding(24)
            .frame(maxWidth: 440)
            .frame(maxWidth: .infinity)
            .frame(minHeight: geo.size.height, alignment: hSize == .regular ? .center : .top)
        }
        .background(BrandBackground())
        }
    }

    private func signIn() {
        busy = true
        error = nil
        Task {
            do {
                try await appState.signIn(email: email, password: password)
            } catch {
                self.error = error.localizedDescription
            }
            busy = false
        }
    }
}

/// A titled input row: label above, icon + field in a soft rounded well.
struct BrandField<Content: View>: View {
    let label: String
    let icon: String
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.geist(13, .medium)).foregroundStyle(.secondary)
            HStack(spacing: 10) {
                Image(systemName: icon).foregroundStyle(Brand.teal).frame(width: 20)
                content.font(.geist(16))
            }
            .padding(.horizontal, 14).frame(height: 50)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 12))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color(.separator).opacity(0.5), lineWidth: 1))
        }
    }
}

/// Subtle teal wash behind the auth screens.
struct BrandBackground: View {
    var body: some View {
        LinearGradient(
            colors: [Brand.teal.opacity(0.10), Color(.systemBackground)],
            startPoint: .top, endPoint: .center
        )
        .ignoresSafeArea()
    }
}
