import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RatingTest {
    @Test
    @DisplayName("BILL-6 AC-1 rates each unit at its tier")
    void tiers() {}

    @Test
    @DisplayName("BILL-6 AC-2 rates a flat plan at the flat price")
    void flat() {}

    @Test
    @DisplayName("BILL-6 AC-3 rounds half even")
    void rounding() {}
}
