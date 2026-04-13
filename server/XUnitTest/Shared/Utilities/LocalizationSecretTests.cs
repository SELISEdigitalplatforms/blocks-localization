using Blocks.Genesis;
using BlocksTemplate.DomainService.Shared.Entities;
using FluentAssertions;

namespace BlocksTemplate.XUnitTest
{
    public class LocalizationSecretTests
    {
        [Fact]
        public void Properties_CanBeAssignedAndRead()
        {
            var secret = new LocalizationSecret
            {
                ChatGptEncryptedSecret = "encrypted-value",
                ChatGptEncryptionKey = "encryption-key"
            };

            secret.ChatGptEncryptedSecret.Should().Be("encrypted-value");
            secret.ChatGptEncryptionKey.Should().Be("encryption-key");
        }

        [Fact]
        public void LocalizationSecret_ImplementsILocalizationSecret()
        {
            var secret = new LocalizationSecret();
            secret.Should().BeAssignableTo<ILocalizationSecret>();
        }

        #region UpdateProperty

        [Fact]
        public void UpdateProperty_UpdatesWritableProperty()
        {
            var secret = new LocalizationSecret
            {
                ChatGptEncryptedSecret = "before"
            };

            LocalizationSecret.UpdateProperty(secret, nameof(LocalizationSecret.ChatGptEncryptedSecret), "after");

            secret.ChatGptEncryptedSecret.Should().Be("after");
        }

        [Fact]
        public void UpdateProperty_InvalidProperty_DoesNotThrowOrChangeValues()
        {
            var secret = new LocalizationSecret
            {
                ChatGptEncryptedSecret = "original",
                ChatGptEncryptionKey = "key"
            };

            var action = () => LocalizationSecret.UpdateProperty(secret, "MissingProperty", "value");

            action.Should().NotThrow();
            secret.ChatGptEncryptedSecret.Should().Be("original");
            secret.ChatGptEncryptionKey.Should().Be("key");
        }

        [Fact]
        public void UpdateProperty_UpdatesEncryptionKey()
        {
            var secret = new LocalizationSecret
            {
                ChatGptEncryptionKey = "old-key"
            };

            LocalizationSecret.UpdateProperty(secret, nameof(LocalizationSecret.ChatGptEncryptionKey), "new-key");

            secret.ChatGptEncryptionKey.Should().Be("new-key");
        }

        [Fact]
        public void UpdateProperty_WithDifferentObjectType_Works()
        {
            var obj = new TestWritableObject { Name = "before" };
            LocalizationSecret.UpdateProperty(obj, "Name", "after");
            obj.Name.Should().Be("after");
        }

        [Fact]
        public void UpdateProperty_WithNullPropertyName_ThrowsArgumentNullException()
        {
            var secret = new LocalizationSecret { ChatGptEncryptedSecret = "val" };
            var action = () => LocalizationSecret.UpdateProperty(secret, null!, "value");
            action.Should().Throw<ArgumentNullException>();
        }

        #endregion

        #region ConvertValue

        [Fact]
        public void ConvertValue_TargetTypeString_ReturnsOriginalString()
        {
            var result = LocalizationSecret.ConvertValue("sample", typeof(string));

            result.Should().Be("sample");
        }

        [Fact]
        public void ConvertValue_ValidConvertibleType_ReturnsConvertedValue()
        {
            var result = LocalizationSecret.ConvertValue("42", typeof(int));

            result.Should().Be(42);
            result.Should().BeOfType<int>();
        }

        [Fact]
        public void ConvertValue_InvalidConvertibleType_ReturnsOriginalString()
        {
            var result = LocalizationSecret.ConvertValue("not-a-number", typeof(int));

            result.Should().Be("not-a-number");
        }

        [Fact]
        public void ConvertValue_ToDouble_ReturnsConvertedValue()
        {
            var result = LocalizationSecret.ConvertValue("3.14", typeof(double));
            result.Should().Be(3.14);
        }

        [Fact]
        public void ConvertValue_ToBool_ReturnsConvertedValue()
        {
            var result = LocalizationSecret.ConvertValue("true", typeof(bool));
            result.Should().Be(true);
        }

        [Fact]
        public void ConvertValue_ToLong_ReturnsConvertedValue()
        {
            var result = LocalizationSecret.ConvertValue("9999999999", typeof(long));
            result.Should().Be(9999999999L);
        }

        [Fact]
        public void ConvertValue_InvalidBoolConversion_ReturnsOriginalString()
        {
            var result = LocalizationSecret.ConvertValue("not-bool", typeof(bool));
            result.Should().Be("not-bool");
        }

        [Fact]
        public void ConvertValue_EmptyString_ToInt_ReturnsOriginal()
        {
            var result = LocalizationSecret.ConvertValue("", typeof(int));
            result.Should().Be("");
        }

        [Fact]
        public void ConvertValue_EmptyString_ToString_ReturnsEmpty()
        {
            var result = LocalizationSecret.ConvertValue("", typeof(string));
            result.Should().Be("");
        }

        #endregion

        private class TestWritableObject
        {
            public string Name { get; set; } = "";
        }
    }
}
